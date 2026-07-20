-- ============================================================================
-- PORTAL ALUMNI IKADIS - SKEMA, MIGRASI, RLS, STORAGE, DAN RPC PUBLIK
-- Jalankan seluruh file ini melalui Supabase > SQL Editor.
-- Skrip mempertahankan data lama dan hanya menambah/memperbarui struktur.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- 1. MASTER DATA ALUMNI -------------------------------------------------------
create table if not exists public.alumni (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    nama_lengkap text not null,
    jenis_kelamin text not null,
    kelompok_usia text not null,
    tahun_kelulusan integer not null,
    unit_terakhir text not null,
    pendidikan_terakhir text not null,
    nomor_hp text not null,
    wilayah_domisili text not null,
    pekerjaan text not null,
    memiliki_bisnis text not null default 'Tidak',
    deskripsi_bisnis text,
    created_at timestamptz not null default now()
);

alter table public.alumni add column if not exists nama_bisnis text;
alter table public.alumni add column if not exists instagram_bisnis text;
alter table public.alumni add column if not exists publikasi_bisnis boolean not null default false;
alter table public.alumni add column if not exists consent_at timestamptz;
alter table public.alumni add column if not exists updated_at timestamptz not null default now();

-- Migrasi nama bisnis lama yang sebelumnya digabung dengan deskripsi memakai "-".
update public.alumni
set nama_bisnis = nullif(trim(split_part(deskripsi_bisnis, '-', 1)), '')
where nama_bisnis is null
  and deskripsi_bisnis is not null
  and position('-' in deskripsi_bisnis) > 0;

-- Pastikan tidak ada dua alumni dengan email yang sama (tanpa membedakan huruf besar).
-- Jika baris ini gagal, hapus/rapikan data email ganda terlebih dahulu lalu jalankan ulang.
create unique index if not exists alumni_email_unique_ci on public.alumni (lower(email));
create index if not exists alumni_tahun_kelulusan_idx on public.alumni (tahun_kelulusan);
create index if not exists alumni_bisnis_public_idx on public.alumni (publikasi_bisnis, memiliki_bisnis);

-- 2. DAFTAR ADMIN -------------------------------------------------------------
create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nama text,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 3. GALERI KEGIATAN ----------------------------------------------------------
create table if not exists public.kegiatan (
    id uuid primary key default gen_random_uuid(),
    judul text not null,
    caption text not null,
    tanggal_kegiatan date,
    image_path text not null,
    image_url text not null,
    is_published boolean not null default true,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists kegiatan_public_order_idx on public.kegiatan (is_published, display_order, tanggal_kegiatan desc);

-- 4. PESAN ALUMNI -------------------------------------------------------------
create table if not exists public.alumni_messages (
    id uuid primary key default gen_random_uuid(),
    nama text not null,
    tahun_kelulusan integer,
    pesan text not null,
    is_published boolean not null default false,
    display_order integer not null default 0,
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists alumni_messages_public_idx on public.alumni_messages (is_published, display_order);

-- 5. PENGATURAN SITUS ---------------------------------------------------------
create table if not exists public.site_settings (
    setting_key text primary key,
    setting_value text,
    is_public boolean not null default false,
    updated_at timestamptz not null default now()
);

insert into public.site_settings (setting_key, setting_value, is_public)
values ('instagram_ikadis', 'ikadis_official', true)
on conflict (setting_key) do nothing;

-- 6. TAUTAN WHATSAPP ----------------------------------------------------------
create table if not exists public.whatsapp_links (
    id uuid primary key default gen_random_uuid(),
    kategori_grup text not null,
    url_link text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.whatsapp_links add column if not exists created_at timestamptz not null default now();
alter table public.whatsapp_links add column if not exists updated_at timestamptz not null default now();
create unique index if not exists whatsapp_links_kategori_unique on public.whatsapp_links (kategori_grup);

insert into public.whatsapp_links (kategori_grup, url_link)
values
    ('putra_rentang_1', null), ('putra_rentang_2', null),
    ('putra_rentang_3', null), ('putra_rentang_4', null),
    ('putri_rentang_1', null), ('putri_rentang_2', null),
    ('putri_rentang_3', null), ('putri_rentang_4', null),
    ('pengusaha', null)
on conflict (kategori_grup) do nothing;

-- 7. FUNGSI PEMBANTU DAN RPC PUBLIK ------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users
        where user_id = auth.uid() and active = true
    );
$$;

create or replace function public.get_public_alumni_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
    select count(*)::bigint from public.alumni;
$$;

create or replace function public.get_public_businesses()
returns table (
    nama_lengkap text,
    nama_bisnis text,
    deskripsi_bisnis text,
    instagram_bisnis text
)
language sql
stable
security definer
set search_path = public
as $$
    select
        a.nama_lengkap,
        coalesce(nullif(a.nama_bisnis, ''), 'Usaha Alumni') as nama_bisnis,
        a.deskripsi_bisnis,
        regexp_replace(
            regexp_replace(coalesce(a.instagram_bisnis, ''), '^https?://(www\.)?instagram\.com/', '', 'i'),
            '^@', ''
        ) as instagram_bisnis
    from public.alumni a
    where a.memiliki_bisnis = 'Ya'
      and a.publikasi_bisnis = true
      and nullif(trim(a.instagram_bisnis), '') is not null
    order by a.updated_at desc nulls last, a.created_at desc
    limit 12;
$$;

-- Maksimal lima pesan alumni berstatus tayang.
create or replace function public.enforce_max_five_published_messages()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    published_count integer;
begin
    if new.is_published then
        select count(*) into published_count
        from public.alumni_messages
        where is_published = true
          and id <> new.id;

        if published_count >= 5 then
            raise exception 'Maksimal lima pesan alumni dapat ditampilkan.';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists alumni_messages_max_five on public.alumni_messages;
create trigger alumni_messages_max_five
before insert or update of is_published on public.alumni_messages
for each row execute function public.enforce_max_five_published_messages();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists alumni_updated_at on public.alumni;
create trigger alumni_updated_at before update on public.alumni
for each row execute function public.set_updated_at();

drop trigger if exists kegiatan_updated_at on public.kegiatan;
create trigger kegiatan_updated_at before update on public.kegiatan
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_links_updated_at on public.whatsapp_links;
create trigger whatsapp_links_updated_at before update on public.whatsapp_links
for each row execute function public.set_updated_at();

-- 8. ROW LEVEL SECURITY -------------------------------------------------------
alter table public.alumni enable row level security;
alter table public.admin_users enable row level security;
alter table public.kegiatan enable row level security;
alter table public.alumni_messages enable row level security;
alter table public.site_settings enable row level security;
alter table public.whatsapp_links enable row level security;

-- Hapus seluruh policy lama pada tabel portal agar tidak ada policy permisif tersisa.
do $$
declare
    p record;
begin
    for p in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('alumni', 'admin_users', 'kegiatan', 'alumni_messages', 'site_settings', 'whatsapp_links')
    loop
        execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    end loop;
end $$;

-- Alumni: publik hanya boleh mendaftar; pemilik terverifikasi hanya membaca/mengubah data sendiri.
create policy alumni_public_insert on public.alumni
for insert to anon, authenticated
with check (
    nullif(trim(email), '') is not null
    and nullif(trim(nama_lengkap), '') is not null
    and consent_at is not null
    and tahun_kelulusan between 1928 and extract(year from now())::integer
);

create policy alumni_owner_select on public.alumni
for select to authenticated
using (
    public.is_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy alumni_owner_update on public.alumni
for update to authenticated
using (
    public.is_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
    public.is_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy alumni_admin_delete on public.alumni
for delete to authenticated
using (public.is_admin());

-- Daftar admin hanya dapat dilihat/dikelola admin.
create policy admin_users_admin_all on public.admin_users
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Kegiatan: publik hanya melihat yang tayang; admin mengelola semuanya.
create policy kegiatan_public_read on public.kegiatan
for select to anon, authenticated
using (is_published = true or public.is_admin());

create policy kegiatan_admin_insert on public.kegiatan
for insert to authenticated
with check (public.is_admin());

create policy kegiatan_admin_update on public.kegiatan
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy kegiatan_admin_delete on public.kegiatan
for delete to authenticated
using (public.is_admin());

-- Pesan: siapa pun dapat mengirim, hanya pesan terkurasi yang dapat dibaca publik.
create policy alumni_messages_public_insert on public.alumni_messages
for insert to anon, authenticated
with check (
    is_published = false
    and reviewed_at is null
    and reviewed_by is null
    and char_length(trim(nama)) between 2 and 120
    and char_length(trim(pesan)) between 20 and 500
);

create policy alumni_messages_public_read on public.alumni_messages
for select to anon, authenticated
using (is_published = true or public.is_admin());

create policy alumni_messages_admin_update on public.alumni_messages
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy alumni_messages_admin_delete on public.alumni_messages
for delete to authenticated
using (public.is_admin());

-- Pengaturan publik dapat dibaca; hanya admin dapat mengubah.
create policy site_settings_public_read on public.site_settings
for select to anon, authenticated
using (is_public = true or public.is_admin());

create policy site_settings_admin_insert on public.site_settings
for insert to authenticated
with check (public.is_admin());

create policy site_settings_admin_update on public.site_settings
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy site_settings_admin_delete on public.site_settings
for delete to authenticated
using (public.is_admin());

-- Tautan komunitas dibaca publik setelah pendaftaran; hanya admin yang mengubah.
create policy whatsapp_links_public_read on public.whatsapp_links
for select to anon, authenticated
using (true);

create policy whatsapp_links_admin_insert on public.whatsapp_links
for insert to authenticated
with check (public.is_admin());

create policy whatsapp_links_admin_update on public.whatsapp_links
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy whatsapp_links_admin_delete on public.whatsapp_links
for delete to authenticated
using (public.is_admin());

-- 9. HAK AKSES DATABASE -------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on public.alumni from anon, authenticated;
grant insert (email, nama_lengkap, jenis_kelamin, kelompok_usia, tahun_kelulusan,
    unit_terakhir, pendidikan_terakhir, nomor_hp, wilayah_domisili, pekerjaan,
    memiliki_bisnis, nama_bisnis, deskripsi_bisnis, instagram_bisnis,
    publikasi_bisnis, consent_at) on public.alumni to anon, authenticated;
grant select, update, delete on public.alumni to authenticated;

grant select on public.kegiatan to anon, authenticated;
grant insert, update, delete on public.kegiatan to authenticated;

grant select, insert on public.alumni_messages to anon, authenticated;
grant update, delete on public.alumni_messages to authenticated;

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

grant select on public.whatsapp_links to anon, authenticated;
grant insert, update, delete on public.whatsapp_links to authenticated;

grant select, insert, update, delete on public.admin_users to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.get_public_alumni_count() from public;
revoke all on function public.get_public_businesses() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_public_alumni_count() to anon, authenticated;
grant execute on function public.get_public_businesses() to anon, authenticated;

-- 10. STORAGE FOTO KEGIATAN ---------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'kegiatan', 'kegiatan', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists kegiatan_storage_public_read on storage.objects;
drop policy if exists kegiatan_storage_admin_insert on storage.objects;
drop policy if exists kegiatan_storage_admin_update on storage.objects;
drop policy if exists kegiatan_storage_admin_delete on storage.objects;

create policy kegiatan_storage_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'kegiatan');

create policy kegiatan_storage_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'kegiatan' and public.is_admin());

create policy kegiatan_storage_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'kegiatan' and public.is_admin())
with check (bucket_id = 'kegiatan' and public.is_admin());

create policy kegiatan_storage_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'kegiatan' and public.is_admin());

commit;

-- ============================================================================
-- SETELAH SKRIP BERHASIL:
-- 1. Buat user admin di Authentication > Users > Add user.
-- 2. Salin UUID user tersebut.
-- 3. Jalankan perintah berikut dengan UUID dan nama admin yang sebenarnya:
--
-- insert into public.admin_users (user_id, nama)
-- values ('UUID-USER-DARI-AUTHENTICATION', 'Nama Admin IKADIS')
-- on conflict (user_id) do update set nama = excluded.nama, active = true;
-- ============================================================================

(() => {
    "use strict";

    const SUPABASE_URL = "https://sysrymtygxgydivvmajk.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_hxI5AY_PM7MotqDKVmiuiA_NYs1viez";

    const DOMICILE_OPTIONS = [
        "Kecamatan Serengan Kota Solo", "Kecamatan Pasar Kliwon Kota Solo",
        "Kecamatan Banjarsari Kota Solo", "Kecamatan Jebres Kota Solo",
        "Kecamatan Laweyan Kota Solo", "Kabupaten Sukoharjo", "Kabupaten Karanganyar",
        "Semarang (Jawa Tengah)", "Yogyakarta (DIY)", "Surabaya (Jawa Timur)",
        "Bandung (Jawa Barat)", "Jakarta (DKI Jakarta)", "Luar Jawa", "Luar Negeri"
    ];

    const JOB_OPTIONS = [
        "Pelajar/Siswa/Mahasiswa", "PNS", "Karyawan BUMN", "Karyawan Swasta",
        "Buruh Kerja", "Petani/Peternak/Nelayan", "Guru/Dosen/Tenaga Pengajar",
        "Tentara/Polisi", "Dokter/Tenaga Kesehatan", "Artis/Seniman",
        "Wiraswasta/Pedagang", "Pengacara/PPAT/Tenaga Hukum", "Pilot/Pramugari",
        "Ibu Rumah Tangga", "Tidak Bekerja/Mencari Kerja", "Lainnya"
    ];

    const WA_LABELS = {
        putra_rentang_1: "Putra usia 17–30 tahun",
        putra_rentang_2: "Putra usia 31–45 tahun",
        putra_rentang_3: "Putra usia 46–60 tahun",
        putra_rentang_4: "Putra usia di atas 60 tahun",
        putri_rentang_1: "Putri usia 17–30 tahun",
        putri_rentang_2: "Putri usia 31–45 tahun",
        putri_rentang_3: "Putri usia 46–60 tahun",
        putri_rentang_4: "Putri usia di atas 60 tahun",
        pengusaha: "Grup pengusaha alumni"
    };

    const state = {
        supabase: null,
        registrationStep: 1,
        publicMessages: [],
        messageIndex: 0,
        messageTimer: null,
        alumni: [],
        activities: [],
        adminMessages: [],
        whatsappLinks: [],
        settings: {},
        charts: {},
        adminVerified: false,
        confirmAction: null,
        editingActivity: null,
        updateEmail: ""
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        initializeSupabase();
        populateSelects();
        bindEvents();
        setDynamicYears();
        renderIcons();
        showView("home", { reset: false });

        await loadPublicContent();

        if (state.supabase) {
            state.supabase.auth.onAuthStateChange(event => {
                if (event === "SIGNED_OUT") state.adminVerified = false;
            });
        }
    }

    function initializeSupabase() {
        if (!window.supabase?.createClient) {
            showToast("Library basis data gagal dimuat. Periksa koneksi internet.", "error");
            return;
        }
        state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
        });
    }

    function bindEvents() {
        document.addEventListener("click", event => {
            const viewButton = event.target.closest("[data-view]");
            if (viewButton) {
                event.preventDefault();
                showView(viewButton.dataset.view);
                closeMobileMenu();
                return;
            }

            const scrollButton = event.target.closest("[data-scroll]");
            if (scrollButton) {
                event.preventDefault();
                scrollHomeSection(scrollButton.dataset.scroll);
                closeMobileMenu();
                return;
            }

            const closeButton = event.target.closest("[data-close-modal]");
            if (closeButton) closeModal(closeButton.dataset.closeModal);
        });

        $("#mobile-menu-button").addEventListener("click", toggleMobileMenu);
        window.addEventListener("scroll", () => $("#site-header").classList.toggle("scrolled", window.scrollY > 12), { passive: true });

        $("#reg-next").addEventListener("click", () => moveRegistrationStep(1));
        $("#reg-prev").addEventListener("click", () => moveRegistrationStep(-1));
        $("#registration-form").addEventListener("submit", submitRegistration);
        $("#reg-job").addEventListener("change", toggleCustomJob);
        $$('input[name="reg-business"]').forEach(input => input.addEventListener("change", toggleRegistrationBusiness));

        $("#update-request-form").addEventListener("submit", requestUpdateLink);
        $("#update-profile-form").addEventListener("submit", submitProfileUpdate);
        $$('input[name="update-business"]').forEach(input => input.addEventListener("change", toggleUpdateBusiness));

        $("#open-message-modal").addEventListener("click", () => openModal("message-modal"));
        $("#share-portal-button").addEventListener("click", sharePortalToWhatsapp);
        $("#public-message-form").addEventListener("submit", submitPublicMessage);
        $("#message-prev").addEventListener("click", () => changeMessage(-1));
        $("#message-next").addEventListener("click", () => changeMessage(1));

        $("#admin-login-form").addEventListener("submit", adminLogin);
        $("#admin-logout").addEventListener("click", adminLogout);
        $("#admin-mobile-menu").addEventListener("click", () => $(".admin-sidebar").classList.toggle("open"));
        $("#admin-tabs").addEventListener("click", event => {
            const button = event.target.closest("[data-admin-tab]");
            if (button) switchAdminTab(button.dataset.adminTab);
        });

        $("#admin-alumni-search").addEventListener("input", event => renderAdminAlumni(event.target.value));
        $("#export-alumni").addEventListener("click", exportAlumniToExcel);
        $("#admin-alumni-body").addEventListener("click", handleAlumniTableAction);

        $("#activity-form").addEventListener("submit", saveActivity);
        $("#activity-cancel").addEventListener("click", resetActivityForm);
        $("#admin-activity-list").addEventListener("click", handleActivityAction);
        $("#admin-message-list").addEventListener("click", handleMessageAdminAction);

        $("#instagram-settings-form").addEventListener("submit", saveInstagramSetting);
        $("#whatsapp-settings-form").addEventListener("submit", saveWhatsappSettings);

        $("#confirm-action").addEventListener("click", async () => {
            const action = state.confirmAction;
            closeModal("confirm-modal");
            state.confirmAction = null;
            if (action) await action();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal:not(.hidden)").forEach(modal => closeModal(modal.id));
                closeMobileMenu();
            }
        });
    }

    function populateSelects() {
        fillSelect($("#reg-domicile"), DOMICILE_OPTIONS, "Pilih wilayah");
        fillSelect($("#update-domicile"), DOMICILE_OPTIONS, "Pilih wilayah");
        fillSelect($("#reg-job"), JOB_OPTIONS, "Pilih bidang pekerjaan");
        fillSelect($("#update-job"), JOB_OPTIONS, "Pilih bidang pekerjaan");
    }

    function fillSelect(select, options, placeholder) {
        select.replaceChildren(new Option(placeholder, ""));
        options.forEach(value => select.add(new Option(value, value)));
    }

    function setDynamicYears() {
        const currentYear = new Date().getFullYear();
        [$("#reg-year"), $("#message-year")].forEach(select => {
            const first = select.options[0];
            select.replaceChildren(first);
            for (let year = currentYear; year >= 1928; year -= 1) select.add(new Option(String(year), String(year)));
        });
        $("#ypid-age").textContent = String(currentYear - 1928);
        $("#footer-year").textContent = String(currentYear);
    }

    function renderIcons() {
        if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }

    function showView(name, options = {}) {
        const target = $(`#view-${name}`);
        if (!target) return;

        $$(".view").forEach(view => view.classList.add("hidden"));
        target.classList.remove("hidden");
        const isAdminDashboard = name === "admin-dashboard";
        $("#site-header").classList.toggle("hidden", isAdminDashboard);
        $("#site-footer").classList.toggle("hidden", isAdminDashboard || name === "admin-login");

        if (name === "register" && options.reset !== false) resetRegistrationForm();
        if (name === "update" && options.reset !== false) resetUpdateView();
        if (name === "admin-dashboard") fetchAdminDashboard();

        window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
        window.setTimeout(renderIcons, 20);
    }

    function scrollHomeSection(sectionId) {
        showView("home", { reset: false, instant: true });
        window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    }

    function toggleMobileMenu() {
        const menu = $("#mobile-menu");
        const button = $("#mobile-menu-button");
        menu.classList.toggle("hidden");
        button.setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
    }

    function closeMobileMenu() {
        $("#mobile-menu").classList.add("hidden");
        $("#mobile-menu-button").setAttribute("aria-expanded", "false");
    }

    async function loadPublicContent() {
        if (!state.supabase) return;
        const tasks = [loadPublicCount(), loadPublicActivities(), loadPublicBusinesses(), loadPublicMessages(), loadPublicSettings()];
        await Promise.allSettled(tasks);
        renderIcons();
    }

    async function loadPublicCount() {
        const { data, error } = await state.supabase.rpc("get_public_alumni_count");
        if (error) throw error;
        $("#public-alumni-count").textContent = new Intl.NumberFormat("id-ID").format(Number(data || 0));
    }

    async function loadPublicActivities() {
        const { data, error } = await state.supabase
            .from("kegiatan")
            .select("id,judul,caption,tanggal_kegiatan,image_url,display_order")
            .eq("is_published", true)
            .order("display_order", { ascending: true })
            .order("tanggal_kegiatan", { ascending: false })
            .limit(7);
        if (error) throw error;
        renderPublicActivities(data || []);
    }

    function renderPublicActivities(activities) {
        const grid = $("#activity-grid");
        if (!activities.length) {
            grid.innerHTML = '<div class="empty-state span-all"><i data-lucide="images"></i><p>Dokumentasi kegiatan akan segera ditampilkan.</p></div>';
            renderIcons();
            return;
        }
        grid.innerHTML = activities.map(item => `
            <article class="activity-card">
                <img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(item.judul)}" loading="lazy">
                <div class="activity-content">
                    <time datetime="${escapeAttr(item.tanggal_kegiatan || "")}"><i data-lucide="calendar-days"></i>${formatDate(item.tanggal_kegiatan)}</time>
                    <h3>${escapeHTML(item.judul)}</h3>
                    <p>${escapeHTML(item.caption)}</p>
                </div>
            </article>`).join("");
        $$('img', grid).forEach(image => image.addEventListener("error", () => image.closest(".activity-card")?.classList.add("image-error"), { once: true }));
        renderIcons();
    }

    async function loadPublicBusinesses() {
        const { data, error } = await state.supabase.rpc("get_public_businesses");
        if (error) throw error;
        renderPublicBusinesses(data || []);
    }

    function renderPublicBusinesses(businesses) {
        const grid = $("#business-grid");
        if (!businesses.length) {
            grid.innerHTML = '<div class="empty-state empty-state-dark span-all"><i data-lucide="store"></i><p>Bisnis alumni akan segera ditampilkan.</p></div>';
            renderIcons();
            return;
        }

        grid.innerHTML = businesses.map((business, index) => {
            const handle = sanitizeInstagramHandle(business.instagram_bisnis);
            const profileUrl = instagramProfileUrl(handle);
            const initials = getInitials(business.nama_bisnis || business.nama_lengkap);
            const avatarUrl = `https://unavatar.io/instagram/${encodeURIComponent(handle)}`;
            return `
                <article class="business-card">
                    <div class="business-cover">
                        <div class="business-fallback">${escapeHTML(initials)}</div>
                        <img class="instagram-avatar" src="${escapeAttr(avatarUrl)}" alt="Foto profil Instagram ${escapeAttr(business.nama_bisnis)}" data-avatar-index="${index}" loading="lazy">
                    </div>
                    <div class="business-card-content">
                        <h3>${escapeHTML(business.nama_bisnis || "Usaha Alumni")}</h3>
                        <p class="business-owner">Pemilik: ${escapeHTML(business.nama_lengkap)}</p>
                        <p class="business-description">${escapeHTML(business.deskripsi_bisnis || "Usaha milik keluarga besar alumni IKADIS.")}</p>
                        <a class="instagram-link" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer">
                            <span><i data-lucide="instagram"></i>@${escapeHTML(handle)}</span><i data-lucide="arrow-up-right"></i>
                        </a>
                    </div>
                </article>`;
        }).join("");

        $$(".instagram-avatar", grid).forEach(image => {
            const hideBrokenAvatar = () => image.classList.add("hidden");
            image.addEventListener("error", hideBrokenAvatar, { once: true });
            image.addEventListener("load", () => {
                if (image.naturalWidth < 30) hideBrokenAvatar();
            }, { once: true });
        });
        renderIcons();
    }

    async function loadPublicMessages() {
        const { data, error } = await state.supabase
            .from("alumni_messages")
            .select("id,nama,tahun_kelulusan,pesan,display_order")
            .eq("is_published", true)
            .order("display_order", { ascending: true })
            .limit(5);
        if (error) throw error;
        state.publicMessages = data || [];
        state.messageIndex = 0;
        renderMessageSlide();
        startMessageAutoplay();
    }

    function renderMessageSlide() {
        const slide = $("#message-slide");
        const dots = $("#message-dots");
        const messages = state.publicMessages;

        if (!messages.length) {
            slide.innerHTML = '<blockquote>Pesan alumni yang telah disetujui admin akan ditampilkan di sini.</blockquote><div class="message-author"><strong>Keluarga Besar IKADIS</strong><span>Alumni Diponegoro Surakarta</span></div>';
            dots.innerHTML = "";
            return;
        }

        const message = messages[state.messageIndex];
        slide.classList.add("changing");
        window.setTimeout(() => {
            slide.innerHTML = `<blockquote>“${escapeHTML(message.pesan)}”</blockquote><div class="message-author"><strong>${escapeHTML(message.nama)}</strong><span>${message.tahun_kelulusan ? `Alumni angkatan ${escapeHTML(String(message.tahun_kelulusan))}` : "Alumni Diponegoro Surakarta"}</span></div>`;
            slide.classList.remove("changing");
        }, 150);

        dots.innerHTML = messages.map((_, index) => `<button type="button" class="${index === state.messageIndex ? "active" : ""}" data-message-index="${index}" aria-label="Tampilkan pesan ${index + 1}"></button>`).join("");
        $$('[data-message-index]', dots).forEach(button => button.addEventListener("click", () => {
            state.messageIndex = Number(button.dataset.messageIndex);
            renderMessageSlide();
            startMessageAutoplay();
        }));
    }

    function changeMessage(direction) {
        if (state.publicMessages.length < 2) return;
        state.messageIndex = (state.messageIndex + direction + state.publicMessages.length) % state.publicMessages.length;
        renderMessageSlide();
        startMessageAutoplay();
    }

    function startMessageAutoplay() {
        window.clearInterval(state.messageTimer);
        if (state.publicMessages.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            state.messageTimer = window.setInterval(() => changeMessage(1), 7000);
        }
    }

    async function loadPublicSettings() {
        const { data, error } = await state.supabase.from("site_settings").select("setting_key,setting_value").eq("is_public", true);
        if (error) throw error;
        const settings = Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
        applyPublicSettings(settings);
    }

    function applyPublicSettings(settings) {
        const handle = sanitizeInstagramHandle(settings.instagram_ikadis || "");
        const url = handle ? instagramProfileUrl(handle) : "#";
        [$("#header-instagram-link"), $("#mobile-instagram-link"), $("#footer-instagram-link")].forEach(link => {
            link.href = url;
            link.classList.toggle("is-disabled", !handle);
        });
    }

    function resetRegistrationForm() {
        $("#registration-form").reset();
        state.registrationStep = 1;
        toggleCustomJob();
        toggleRegistrationBusiness();
        updateStepInterface();
        clearInvalidFields($("#registration-form"));
    }

    function moveRegistrationStep(direction) {
        if (direction > 0 && !validateRegistrationStep(state.registrationStep)) {
            showToast("Mohon lengkapi seluruh kolom wajib dengan format yang benar.", "error");
            return;
        }
        state.registrationStep = Math.min(4, Math.max(1, state.registrationStep + direction));
        updateStepInterface();
    }

    function updateStepInterface() {
        $$(".form-step").forEach(step => step.classList.toggle("hidden", Number(step.dataset.step) !== state.registrationStep));
        $$(".step-dot").forEach((dot, index) => dot.classList.toggle("active", index < state.registrationStep));
        $("#step-progress").style.width = `${((state.registrationStep - 1) / 3) * 100}%`;
        $("#reg-prev").disabled = state.registrationStep === 1;
        $("#reg-next").classList.toggle("hidden", state.registrationStep === 4);
        $("#reg-submit").classList.toggle("hidden", state.registrationStep !== 4);
        $(".form-card").scrollIntoView({ behavior: "smooth", block: "start" });
        renderIcons();
    }

    function validateRegistrationStep(stepNumber) {
        const step = $(`.form-step[data-step="${stepNumber}"]`);
        clearInvalidFields(step);
        let valid = true;
        const requiredFields = $$('input[required], select[required], textarea[required]', step);

        requiredFields.forEach(field => {
            if (field.type === "radio") {
                const group = $(`input[name="${field.name}"]:checked`, step);
                if (!group) valid = false;
            } else if (field.type === "checkbox") {
                if (!field.checked) { field.classList.add("invalid"); valid = false; }
            } else if (!field.value.trim() || !field.checkValidity()) {
                field.classList.add("invalid");
                valid = false;
            }
        });

        if (stepNumber === 3) {
            const phone = $("#reg-phone");
            if (!isValidPhone(phone.value)) { phone.classList.add("invalid"); valid = false; }
        }

        if (stepNumber === 4) {
            const business = $('input[name="reg-business"]:checked')?.value === "Ya";
            if (business) {
                [$("#reg-business-name"), $("#reg-business-description"), $("#reg-business-instagram")].forEach(field => {
                    if (!field.value.trim()) { field.classList.add("invalid"); valid = false; }
                });
                if (!isValidInstagramHandle($("#reg-business-instagram").value)) {
                    $("#reg-business-instagram").classList.add("invalid"); valid = false;
                }
                if (!$("#reg-business-consent").checked) { valid = false; }
            }
        }
        return valid;
    }

    function toggleCustomJob() {
        const custom = $("#reg-job").value === "Lainnya";
        $("#custom-job-field").classList.toggle("hidden", !custom);
        $("#reg-custom-job").required = custom;
    }

    function toggleRegistrationBusiness() {
        const show = $('input[name="reg-business"]:checked')?.value === "Ya";
        $("#business-fields").classList.toggle("hidden", !show);
        [$("#reg-business-name"), $("#reg-business-description"), $("#reg-business-instagram")].forEach(field => field.required = show);
        $("#reg-business-consent").required = show;
    }

    async function submitRegistration(event) {
        event.preventDefault();
        if ($("#reg-website").value) return;
        if (!validateRegistrationStep(4) || !state.supabase) {
            showToast("Mohon lengkapi formulir dan persetujuan yang diperlukan.", "error");
            return;
        }

        const hasBusiness = $('input[name="reg-business"]:checked').value === "Ya";
        const job = $("#reg-job").value === "Lainnya" ? $("#reg-custom-job").value.trim() : $("#reg-job").value;
        const payload = {
            email: $("#reg-email").value.trim().toLowerCase(),
            nama_lengkap: $("#reg-name").value.trim(),
            jenis_kelamin: $('input[name="reg-gender"]:checked').value,
            kelompok_usia: $("#reg-age").value,
            tahun_kelulusan: Number($("#reg-year").value),
            unit_terakhir: $('input[name="reg-unit"]:checked').value,
            pendidikan_terakhir: $("#reg-education").value,
            nomor_hp: normalizePhone($("#reg-phone").value),
            wilayah_domisili: $("#reg-domicile").value,
            pekerjaan: job,
            memiliki_bisnis: hasBusiness ? "Ya" : "Tidak",
            nama_bisnis: hasBusiness ? $("#reg-business-name").value.trim() : null,
            deskripsi_bisnis: hasBusiness ? $("#reg-business-description").value.trim() : null,
            instagram_bisnis: hasBusiness ? sanitizeInstagramHandle($("#reg-business-instagram").value) : null,
            publikasi_bisnis: hasBusiness && $("#reg-business-consent").checked,
            consent_at: new Date().toISOString()
        };

        setLoading(true, "Menyimpan data alumni...");
        try {
            const { error } = await state.supabase.from("alumni").insert(payload);
            if (error) throw error;
            await configureSuccessLinks(payload.kelompok_usia, payload.jenis_kelamin, payload.memiliki_bisnis);
            showView("success");
            resetRegistrationForm();
            loadPublicContent();
        } catch (error) {
            const duplicate = error.code === "23505";
            showToast(duplicate ? "Email tersebut sudah terdaftar. Gunakan menu Perbarui Profil." : friendlyError(error, "Data belum berhasil disimpan."), "error");
        } finally {
            setLoading(false);
        }
    }

    async function configureSuccessLinks(age, gender, business) {
        const range = ageRangeIndex(age);
        const category = `${gender === "Laki-laki" ? "putra" : "putri"}_rentang_${range}`;
        const { data } = await state.supabase.from("whatsapp_links").select("kategori_grup,url_link").in("kategori_grup", [category, "pengusaha"]);
        const links = Object.fromEntries((data || []).map(row => [row.kategori_grup, row.url_link]));
        setOptionalLink($("#success-group-link"), links[category]);
        setOptionalLink($("#success-business-link"), business === "Ya" ? links.pengusaha : "");
    }

    function setOptionalLink(element, url) {
        const valid = /^https:\/\//i.test(url || "");
        element.classList.toggle("hidden", !valid);
        element.href = valid ? url : "#";
    }

    function resetUpdateView() {
        state.updateEmail = "";
        $("#update-request-form").reset();
        $("#update-request-form").classList.remove("hidden");
        $("#update-profile-form").classList.add("hidden");
        $("#update-profile-form").reset();
        $("#verified-email-label").textContent = "Profil ditemukan";
        toggleUpdateBusiness();
    }

    async function requestUpdateLink(event) {
        event.preventDefault();
        if (!state.supabase) {
            showToast("Koneksi ke sistem belum tersedia. Silakan muat ulang halaman.", "error");
            return;
        }

        const form = event.currentTarget;
        const emailInput = $("#update-email-request");
        const email = emailInput.value.trim().toLowerCase();

        if (!email || !emailInput.checkValidity()) {
            form.reportValidity();
            showToast("Masukkan alamat email yang valid.", "error");
            return;
        }

        setLoading(true, "Mencari data alumni...");
        try {
            const { data, error } = await state.supabase.rpc(
                "get_alumni_profile_by_email",
                { p_email: email }
            );
            if (error) throw error;

            const profile = typeof data === "string" ? JSON.parse(data) : data;
            if (!profile) {
                throw new Error("Email belum terdaftar dalam data alumni IKADIS.");
            }

            state.updateEmail = email;
            $("#update-request-form").classList.add("hidden");
            $("#update-profile-form").classList.remove("hidden");
            $("#verified-email-label").textContent = `Profil ditemukan: ${email}`;
            $("#update-name").value = profile.nama_lengkap || "";
            $("#update-phone").value = profile.nomor_hp || "";
            setSelectValue($("#update-domicile"), profile.wilayah_domisili);
            setSelectValue($("#update-job"), profile.pekerjaan);

            const businessValue = profile.memiliki_bisnis === "Ya" ? "Ya" : "Tidak";
            const businessRadio = $(`input[name="update-business"][value="${businessValue}"]`);
            if (businessRadio) businessRadio.checked = true;
            $("#update-business-name").value = profile.nama_bisnis || "";
            $("#update-business-description").value = profile.deskripsi_bisnis || "";
            $("#update-business-instagram").value = sanitizeInstagramHandle(profile.instagram_bisnis || "");
            $("#update-business-consent").checked = Boolean(profile.publikasi_bisnis);
            toggleUpdateBusiness();
            renderIcons();
            showToast("Profil ditemukan. Silakan perbarui data yang diperlukan.", "success");
        } catch (error) {
            state.updateEmail = "";
            showToast(friendlyError(error, "Profil tidak dapat dibuka."), "error", 6500);
        } finally {
            setLoading(false);
        }
    }

    function setSelectValue(select, value) {
        if (value && !Array.from(select.options).some(option => option.value === value)) select.add(new Option(value, value));
        select.value = value || "";
    }

    function toggleUpdateBusiness() {
        const show = $('input[name="update-business"]:checked')?.value === "Ya";
        $("#update-business-fields").classList.toggle("hidden", !show);
        [$("#update-business-name"), $("#update-business-description"), $("#update-business-instagram")].forEach(field => field.required = show);
        $("#update-business-consent").required = show;
    }

    async function submitProfileUpdate(event) {
        event.preventDefault();
        if (!state.supabase) return;

        const email = state.updateEmail.trim().toLowerCase();
        if (!email) {
            showToast("Silakan cari profil menggunakan email terlebih dahulu.", "error");
            resetUpdateView();
            return;
        }

        const form = event.currentTarget;
        if (!form.checkValidity() || !isValidPhone($("#update-phone").value)) {
            form.reportValidity();
            showToast("Mohon lengkapi data dengan benar.", "error");
            return;
        }

        const hasBusiness = $('input[name="update-business"]:checked')?.value === "Ya";
        if (hasBusiness && !isValidInstagramHandle($("#update-business-instagram").value)) {
            showToast("Nama akun Instagram bisnis belum valid.", "error");
            return;
        }

        const rpcPayload = {
            p_email: email,
            p_nama_lengkap: $("#update-name").value.trim(),
            p_nomor_hp: normalizePhone($("#update-phone").value),
            p_wilayah_domisili: $("#update-domicile").value,
            p_pekerjaan: $("#update-job").value,
            p_memiliki_bisnis: hasBusiness ? "Ya" : "Tidak",
            p_nama_bisnis: hasBusiness ? $("#update-business-name").value.trim() : null,
            p_deskripsi_bisnis: hasBusiness ? $("#update-business-description").value.trim() : null,
            p_instagram_bisnis: hasBusiness ? sanitizeInstagramHandle($("#update-business-instagram").value) : null,
            p_publikasi_bisnis: hasBusiness && $("#update-business-consent").checked
        };

        setLoading(true, "Menyimpan perubahan...");
        try {
            const { data, error } = await state.supabase.rpc(
                "update_alumni_profile_by_email",
                rpcPayload
            );
            if (error) throw error;
            if (data !== true) throw new Error("Data alumni tidak ditemukan atau tidak berubah.");

            state.updateEmail = "";
            showToast("Profil alumni berhasil diperbarui.", "success");
            showView("home");
            loadPublicContent();
        } catch (error) {
            showToast(friendlyError(error, "Profil belum berhasil diperbarui."), "error");
        } finally {
            setLoading(false);
        }
    }

    async function submitPublicMessage(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if ($("#message-website").value || !state.supabase) return;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const payload = {
        nama: $("#message-name").value.trim(),
        tahun_kelulusan: $("#message-year").value
            ? Number($("#message-year").value)
            : null,
        pesan: $("#message-content").value.trim()
    };

    setLoading(true, "Mengirim pesan...");

    try {
        const { error } = await state.supabase
            .from("alumni_messages")
            .insert(payload);

        if (error) throw error;

        form.reset();
        closeModal("message-modal");

        showToast(
            "Pesan telah diterima dan menunggu persetujuan admin.",
            "success",
            6000
        );
    } catch (error) {
        showToast(
            friendlyError(error, "Pesan belum berhasil dikirim."),
            "error"
        );
    } finally {
        setLoading(false);
    }
}

    async function adminLogin(event) {
        event.preventDefault();
        if (!state.supabase) return;
        setLoading(true, "Memverifikasi akses admin...");
        try {
            const email = $("#admin-email").value.trim().toLowerCase();
            const password = $("#admin-password").value;
            const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const isAdmin = await checkAdminRole();
            if (!isAdmin) {
                await state.supabase.auth.signOut();
                throw new Error("Akun ini tidak memiliki hak akses admin IKADIS.");
            }
            state.adminVerified = true;
            $("#admin-user-email").textContent = data.user.email;
            showView("admin-dashboard");
        } catch (error) {
            showToast(friendlyError(error, "Email atau kata sandi admin tidak sesuai."), "error");
        } finally {
            setLoading(false);
        }
    }

    async function checkAdminRole() {
        const { data, error } = await state.supabase.rpc("is_admin");
        if (error) return false;
        return data === true;
    }

    async function requireAdmin() {
        if (!state.supabase) return false;
        const { data } = await state.supabase.auth.getSession();
        if (!data.session) {
            state.adminVerified = false;
            showView("admin-login");
            return false;
        }
        if (!state.adminVerified) state.adminVerified = await checkAdminRole();
        if (!state.adminVerified) {
            await state.supabase.auth.signOut();
            showView("admin-login");
            showToast("Sesi tidak memiliki hak akses admin.", "error");
            return false;
        }
        $("#admin-user-email").textContent = data.session.user.email || "Admin IKADIS";
        return true;
    }

    async function adminLogout() {
        if (state.supabase) await state.supabase.auth.signOut();
        state.adminVerified = false;
        destroyCharts();
        showView("home");
        showToast("Anda telah keluar dari panel admin.", "success");
    }

    function switchAdminTab(name) {
        $$(".admin-pane").forEach(pane => pane.classList.add("hidden"));
        $$("[data-admin-tab]").forEach(button => button.classList.toggle("active", button.dataset.adminTab === name));
        $(`#admin-pane-${name}`)?.classList.remove("hidden");
        const activeButton = $(`[data-admin-tab="${name}"]`);
        $("#admin-page-title").textContent = activeButton ? activeButton.textContent.trim() : "Dashboard";
        $(".admin-sidebar").classList.remove("open");
        renderIcons();
    }

    async function fetchAdminDashboard() {
        if (!(await requireAdmin())) return;
        setLoading(true, "Memuat dashboard...");
        try {
            const [alumniResult, activityResult, messageResult, settingResult, waResult] = await Promise.all([
                state.supabase.from("alumni").select("*").order("created_at", { ascending: false }),
                state.supabase.from("kegiatan").select("*").order("display_order", { ascending: true }).order("created_at", { ascending: false }),
                state.supabase.from("alumni_messages").select("*").order("is_published", { ascending: false }).order("display_order", { ascending: true }).order("created_at", { ascending: false }),
                state.supabase.from("site_settings").select("*"),
                state.supabase.from("whatsapp_links").select("*").order("kategori_grup")
            ]);
            [alumniResult, activityResult, messageResult, settingResult, waResult].forEach(result => { if (result.error) throw result.error; });

            state.alumni = alumniResult.data || [];
            state.activities = activityResult.data || [];
            state.adminMessages = messageResult.data || [];
            state.settings = Object.fromEntries((settingResult.data || []).map(row => [row.setting_key, row.setting_value]));
            state.whatsappLinks = waResult.data || [];

            renderAdminStats();
            renderCharts();
            renderAdminAlumni();
            renderAdminActivities();
            renderAdminMessages();
            renderAdminSettings();
            renderIcons();
        } catch (error) {
            showToast(friendlyError(error, "Dashboard gagal dimuat. Periksa kebijakan RLS dan akun admin."), "error", 7000);
        } finally {
            setLoading(false);
        }
    }

    function renderAdminStats() {
        $("#admin-total-alumni").textContent = formatNumber(state.alumni.length);
        $("#admin-total-business").textContent = formatNumber(state.alumni.filter(row => row.memiliki_bisnis === "Ya").length);
        $("#admin-total-activities").textContent = formatNumber(state.activities.filter(row => row.is_published).length);
        $("#admin-pending-messages").textContent = formatNumber(state.adminMessages.filter(row => !row.is_published).length);
    }

    function renderCharts() {
        if (!window.Chart) return;
        destroyCharts();
        const ageMap = countBy(state.alumni, "kelompok_usia");
        const jobMap = countBy(state.alumni, "pekerjaan");
        const domicileMap = countBy(state.alumni, "wilayah_domisili");
        const yearMap = countBy(state.alumni, "tahun_kelulusan");
        const palette = ["#0077C8", "#A7D8F6", "#1E3A5F", "#42A5D8", "#72BFE8", "#0F9F78", "#8298AD"];

        state.charts.age = new Chart($("#age-chart"), {
            type: "doughnut",
            data: { labels: Object.keys(ageMap), datasets: [{ data: Object.values(ageMap), backgroundColor: palette, borderWidth: 0 }] },
            options: chartOptions("bottom")
        });

        const jobs = Object.entries(jobMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
        state.charts.job = new Chart($("#job-chart"), {
            type: "bar",
            data: { labels: jobs.map(item => item[0]), datasets: [{ data: jobs.map(item => item[1]), backgroundColor: "#0077C8", borderRadius: 7 }] },
            options: { ...chartOptions(false), scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#edf2f6" } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
        });

        const domiciles = Object.entries(domicileMap).sort((a, b) => b[1] - a[1]);
        state.charts.domicile = new Chart($("#domicile-chart"), {
            type: "bar",
            data: { labels: domiciles.map(item => item[0]), datasets: [{ data: domiciles.map(item => item[1]), backgroundColor: "#A7D8F6", borderColor: "#0077C8", borderWidth: 1, borderRadius: 7 }] },
            options: { ...chartOptions(false), indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#edf2f6" } }, y: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
        });

        const years = Object.keys(yearMap).filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(a) - Number(b));
        state.charts.year = new Chart($("#year-chart"), {
            type: "line",
            data: { labels: years, datasets: [{ data: years.map(year => yearMap[year]), borderColor: "#0077C8", backgroundColor: "rgba(0,119,200,.1)", fill: true, tension: .25, pointRadius: 2, pointHoverRadius: 5 }] },
            options: { ...chartOptions(false), scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#edf2f6" } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 14, font: { size: 9 } } } } }
        });
    }

    function chartOptions(legendPosition) {
        return { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: Boolean(legendPosition), position: legendPosition || "bottom", labels: { boxWidth: 10, usePointStyle: true, font: { size: 9 } } } } };
    }

    function destroyCharts() {
        Object.values(state.charts).forEach(chart => chart?.destroy());
        state.charts = {};
    }

    function countBy(items, key) {
        return items.reduce((map, item) => {
            const value = item[key] || "Belum diisi";
            map[value] = (map[value] || 0) + 1;
            return map;
        }, {});
    }

    function renderAdminAlumni(search = "") {
        const term = search.trim().toLowerCase();
        const filtered = state.alumni.filter(row => !term || [row.nama_lengkap, row.tahun_kelulusan, row.pekerjaan, row.wilayah_domisili].some(value => String(value || "").toLowerCase().includes(term)));
        const body = $("#admin-alumni-body");
        if (!filtered.length) {
            body.innerHTML = '<tr><td colspan="9">Tidak ada data yang sesuai.</td></tr>';
            return;
        }
        body.innerHTML = filtered.map(row => `
            <tr>
                <td><strong>${escapeHTML(row.nama_lengkap || "-")}</strong></td>
                <td>${escapeHTML(row.email || "-")}</td>
                <td>${escapeHTML(String(row.tahun_kelulusan || "-"))}</td>
                <td>${escapeHTML(row.unit_terakhir || "-")}</td>
                <td>${escapeHTML(row.nomor_hp || "-")}</td>
                <td>${escapeHTML(row.wilayah_domisili || "-")}</td>
                <td>${escapeHTML(row.pekerjaan || "-")}</td>
                <td><span class="status-pill ${row.memiliki_bisnis === "Ya" ? "active" : ""}">${escapeHTML(row.memiliki_bisnis || "Tidak")}</span></td>
                <td><button class="table-action" type="button" data-delete-alumni="${escapeAttr(row.id)}" aria-label="Hapus ${escapeAttr(row.nama_lengkap)}"><i data-lucide="trash-2"></i></button></td>
            </tr>`).join("");
        renderIcons();
    }

    function handleAlumniTableAction(event) {
        const button = event.target.closest("[data-delete-alumni]");
        if (!button) return;
        const alumni = state.alumni.find(row => String(row.id) === button.dataset.deleteAlumni);
        if (!alumni) return;
        openConfirm(`Hapus data ${alumni.nama_lengkap} secara permanen?`, () => deleteAlumni(alumni.id));
    }

    async function deleteAlumni(id) {
        setLoading(true, "Menghapus data alumni...");
        try {
            const { error } = await state.supabase.from("alumni").delete().eq("id", id);
            if (error) throw error;
            state.alumni = state.alumni.filter(row => row.id !== id);
            renderAdminAlumni($("#admin-alumni-search").value);
            renderAdminStats();
            renderCharts();
            showToast("Data alumni berhasil dihapus.", "success");
        } catch (error) {
            showToast(friendlyError(error, "Data alumni belum berhasil dihapus."), "error");
        } finally { setLoading(false); }
    }

    function exportAlumniToExcel() {
        if (!window.XLSX) { showToast("Modul Excel gagal dimuat.", "error"); return; }
        if (!state.alumni.length) { showToast("Belum ada data untuk diekspor.", "error"); return; }
        const rows = state.alumni.map((row, index) => ({
            NO: index + 1,
            "NAMA LENGKAP": row.nama_lengkap,
            EMAIL: row.email,
            "JENIS KELAMIN": row.jenis_kelamin,
            "KELOMPOK USIA": row.kelompok_usia,
            "TAHUN KELULUSAN": row.tahun_kelulusan,
            "UNIT TERAKHIR": row.unit_terakhir,
            "PENDIDIKAN TERAKHIR": row.pendidikan_terakhir,
            "NOMOR WHATSAPP": row.nomor_hp,
            DOMISILI: row.wilayah_domisili,
            PEKERJAAN: row.pekerjaan,
            "MEMILIKI BISNIS": row.memiliki_bisnis,
            "NAMA BISNIS": row.nama_bisnis || "-",
            "DESKRIPSI BISNIS": row.deskripsi_bisnis || "-",
            "INSTAGRAM BISNIS": row.instagram_bisnis ? instagramProfileUrl(row.instagram_bisnis) : "-",
            "IZIN PUBLIKASI BISNIS": row.publikasi_bisnis ? "Ya" : "Tidak",
            "TANGGAL MENDAFTAR": formatDateTime(row.created_at)
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(key => ({ wch: Math.min(45, Math.max(12, key.length + 2)) }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Data Alumni");
        XLSX.writeFile(workbook, `DATA_ALUMNI_IKADIS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function renderAdminActivities() {
        const list = $("#admin-activity-list");
        if (!state.activities.length) {
            list.innerHTML = '<div class="empty-state"><i data-lucide="images"></i><p>Belum ada kegiatan.</p></div>';
            renderIcons();
            return;
        }
        list.innerHTML = state.activities.map(item => `
            <article class="admin-activity-item">
                <img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(item.judul)}">
                <div><h3>${escapeHTML(item.judul)}</h3><p>${escapeHTML(item.caption)}</p><span class="status-pill ${item.is_published ? "active" : ""}">${item.is_published ? "Tayang" : "Draf"}</span></div>
                <div class="item-actions">
                    <button type="button" class="mini-button ${item.is_published ? "muted" : "success"}" data-activity-toggle="${escapeAttr(item.id)}" title="${item.is_published ? "Sembunyikan" : "Tampilkan"}"><i data-lucide="${item.is_published ? "eye-off" : "eye"}"></i></button>
                    <button type="button" class="mini-button" data-activity-edit="${escapeAttr(item.id)}" title="Edit"><i data-lucide="pencil"></i></button>
                    <button type="button" class="mini-button danger" data-activity-delete="${escapeAttr(item.id)}" title="Hapus"><i data-lucide="trash-2"></i></button>
                </div>
            </article>`).join("");
        renderIcons();
    }

    async function saveActivity(event) {
        event.preventDefault();
        if (!(await requireAdmin())) return;
        const file = $("#activity-file").files[0];
        const editingId = $("#activity-id").value;
        const oldPath = $("#activity-current-path").value;
        if (!editingId && !file) { showToast("Pilih foto kegiatan terlebih dahulu.", "error"); return; }
        if (file && !validateActivityFile(file)) return;

        setLoading(true, file ? "Mengunggah foto kegiatan..." : "Menyimpan kegiatan...");
        let newPath = "";
        try {
            let imageUrl = state.editingActivity?.image_url || "";
            if (file) {
                newPath = createStoragePath(file.name);
                const { error: uploadError } = await state.supabase.storage.from("kegiatan").upload(newPath, file, { cacheControl: "3600", upsert: false });
                if (uploadError) throw uploadError;
                imageUrl = state.supabase.storage.from("kegiatan").getPublicUrl(newPath).data.publicUrl;
            }

            const payload = {
                judul: $("#activity-title").value.trim(),
                caption: $("#activity-caption").value.trim(),
                tanggal_kegiatan: $("#activity-date").value || null,
                image_path: newPath || oldPath,
                image_url: imageUrl,
                is_published: $("#activity-published").checked,
                updated_at: new Date().toISOString()
            };

            const result = editingId
                ? await state.supabase.from("kegiatan").update(payload).eq("id", editingId)
                : await state.supabase.from("kegiatan").insert(payload);
            if (result.error) throw result.error;
            if (newPath && oldPath && oldPath !== newPath) await state.supabase.storage.from("kegiatan").remove([oldPath]);

            showToast(editingId ? "Kegiatan berhasil diperbarui." : "Kegiatan berhasil ditambahkan.", "success");
            resetActivityForm();
            await refreshActivitiesAdmin();
            loadPublicActivities();
        } catch (error) {
            if (newPath) await state.supabase.storage.from("kegiatan").remove([newPath]);
            showToast(friendlyError(error, "Kegiatan belum berhasil disimpan."), "error");
        } finally { setLoading(false); }
    }

    function validateActivityFile(file) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) { showToast("Format foto harus JPG, PNG, atau WebP.", "error"); return false; }
        if (file.size > 5 * 1024 * 1024) { showToast("Ukuran foto maksimal 5 MB.", "error"); return false; }
        return true;
    }

    function createStoragePath(filename) {
        const extension = filename.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const unique = window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return `${new Date().getFullYear()}/${unique}.${extension}`;
    }

    function handleActivityAction(event) {
        const editButton = event.target.closest("[data-activity-edit]");
        const toggleButton = event.target.closest("[data-activity-toggle]");
        const deleteButton = event.target.closest("[data-activity-delete]");
        if (editButton) editActivity(editButton.dataset.activityEdit);
        if (toggleButton) toggleActivity(toggleButton.dataset.activityToggle);
        if (deleteButton) {
            const item = state.activities.find(row => String(row.id) === deleteButton.dataset.activityDelete);
            if (item) openConfirm(`Hapus kegiatan “${item.judul}” beserta fotonya?`, () => deleteActivity(item));
        }
    }

    function editActivity(id) {
        const item = state.activities.find(row => String(row.id) === String(id));
        if (!item) return;
        state.editingActivity = item;
        $("#activity-id").value = item.id;
        $("#activity-current-path").value = item.image_path || "";
        $("#activity-title").value = item.judul || "";
        $("#activity-caption").value = item.caption || "";
        $("#activity-date").value = item.tanggal_kegiatan || "";
        $("#activity-published").checked = Boolean(item.is_published);
        $("#activity-form-title").textContent = "Edit Kegiatan";
        $("#activity-file-required").textContent = "";
        $("#activity-cancel").classList.remove("hidden");
        $("#activity-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function resetActivityForm() {
        state.editingActivity = null;
        $("#activity-form").reset();
        $("#activity-id").value = "";
        $("#activity-current-path").value = "";
        $("#activity-published").checked = true;
        $("#activity-form-title").textContent = "Tambah Kegiatan";
        $("#activity-file-required").textContent = "*";
        $("#activity-cancel").classList.add("hidden");
    }

    async function toggleActivity(id) {
        const item = state.activities.find(row => String(row.id) === String(id));
        if (!item) return;
        setLoading(true, "Mengubah status kegiatan...");
        try {
            const { error } = await state.supabase.from("kegiatan").update({ is_published: !item.is_published, updated_at: new Date().toISOString() }).eq("id", item.id);
            if (error) throw error;
            await refreshActivitiesAdmin();
            loadPublicActivities();
            showToast(`Kegiatan berhasil ${item.is_published ? "disembunyikan" : "ditampilkan"}.`, "success");
        } catch (error) { showToast(friendlyError(error, "Status kegiatan belum berhasil diubah."), "error"); }
        finally { setLoading(false); }
    }

    async function deleteActivity(item) {
        setLoading(true, "Menghapus kegiatan...");
        try {
            const { error } = await state.supabase.from("kegiatan").delete().eq("id", item.id);
            if (error) throw error;
            if (item.image_path) await state.supabase.storage.from("kegiatan").remove([item.image_path]);
            await refreshActivitiesAdmin();
            loadPublicActivities();
            showToast("Kegiatan berhasil dihapus.", "success");
        } catch (error) { showToast(friendlyError(error, "Kegiatan belum berhasil dihapus."), "error"); }
        finally { setLoading(false); }
    }

    async function refreshActivitiesAdmin() {
        const { data, error } = await state.supabase.from("kegiatan").select("*").order("display_order").order("created_at", { ascending: false });
        if (error) throw error;
        state.activities = data || [];
        renderAdminActivities();
        renderAdminStats();
    }

    function renderAdminMessages() {
        const list = $("#admin-message-list");
        if (!state.adminMessages.length) {
            list.innerHTML = '<div class="empty-state span-all"><i data-lucide="messages-square"></i><p>Belum ada pesan alumni.</p></div>';
            renderIcons();
            return;
        }
        list.innerHTML = state.adminMessages.map(item => `
            <article class="admin-message-card ${item.is_published ? "published" : ""}">
                <div class="admin-message-meta"><strong>${escapeHTML(item.nama)}</strong><span>${item.tahun_kelulusan ? `Angkatan ${escapeHTML(String(item.tahun_kelulusan))}` : "Tanpa angkatan"}</span></div>
                <blockquote>“${escapeHTML(item.pesan)}”</blockquote>
                <div class="admin-message-meta"><span>${formatDateTime(item.created_at)}</span><span class="status-pill ${item.is_published ? "active" : ""}">${item.is_published ? `Tayang · urutan ${item.display_order}` : "Menunggu"}</span></div>
                <div class="admin-message-actions">
                    <button type="button" class="primary" data-message-toggle="${escapeAttr(item.id)}"><i data-lucide="${item.is_published ? "eye-off" : "eye"}"></i>${item.is_published ? "Sembunyikan" : "Tampilkan"}</button>
                    ${item.is_published ? `<button type="button" data-message-move="up" data-message-id="${escapeAttr(item.id)}"><i data-lucide="arrow-up"></i>Naik</button><button type="button" data-message-move="down" data-message-id="${escapeAttr(item.id)}"><i data-lucide="arrow-down"></i>Turun</button>` : ""}
                    <button type="button" class="danger" data-message-delete="${escapeAttr(item.id)}"><i data-lucide="trash-2"></i>Hapus</button>
                </div>
            </article>`).join("");
        renderIcons();
    }

    function handleMessageAdminAction(event) {
        const toggle = event.target.closest("[data-message-toggle]");
        const move = event.target.closest("[data-message-move]");
        const remove = event.target.closest("[data-message-delete]");
        if (toggle) toggleAdminMessage(toggle.dataset.messageToggle);
        if (move) moveAdminMessage(move.dataset.messageId, move.dataset.messageMove);
        if (remove) {
            const item = state.adminMessages.find(row => String(row.id) === remove.dataset.messageDelete);
            if (item) openConfirm(`Hapus pesan dari ${item.nama}?`, () => deleteAdminMessage(item.id));
        }
    }

    async function toggleAdminMessage(id) {
        const item = state.adminMessages.find(row => String(row.id) === String(id));
        if (!item) return;
        if (!item.is_published && state.adminMessages.filter(row => row.is_published).length >= 5) {
            showToast("Maksimal lima pesan dapat ditampilkan. Sembunyikan salah satu pesan terlebih dahulu.", "error", 6500);
            return;
        }
        const nextOrder = item.is_published ? item.display_order : Math.max(0, ...state.adminMessages.filter(row => row.is_published).map(row => Number(row.display_order || 0))) + 1;
        setLoading(true, "Mengubah status pesan...");
        try {
            const { error } = await state.supabase.from("alumni_messages").update({ is_published: !item.is_published, display_order: nextOrder, reviewed_at: new Date().toISOString() }).eq("id", item.id);
            if (error) throw error;
            await refreshAdminMessages();
            loadPublicMessages();
            showToast(`Pesan berhasil ${item.is_published ? "disembunyikan" : "ditampilkan"}.`, "success");
        } catch (error) { showToast(friendlyError(error, "Status pesan belum berhasil diubah."), "error"); }
        finally { setLoading(false); }
    }

    async function moveAdminMessage(id, direction) {
        const published = state.adminMessages.filter(row => row.is_published).sort((a, b) => Number(a.display_order) - Number(b.display_order));
        const index = published.findIndex(row => String(row.id) === String(id));
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= published.length) return;
        const current = published[index];
        const target = published[targetIndex];
        setLoading(true, "Mengatur urutan pesan...");
        try {
            const [first, second] = await Promise.all([
                state.supabase.from("alumni_messages").update({ display_order: target.display_order }).eq("id", current.id),
                state.supabase.from("alumni_messages").update({ display_order: current.display_order }).eq("id", target.id)
            ]);
            if (first.error) throw first.error;
            if (second.error) throw second.error;
            await refreshAdminMessages();
            loadPublicMessages();
        } catch (error) { showToast(friendlyError(error, "Urutan pesan belum berhasil diubah."), "error"); }
        finally { setLoading(false); }
    }

    async function deleteAdminMessage(id) {
        setLoading(true, "Menghapus pesan...");
        try {
            const { error } = await state.supabase.from("alumni_messages").delete().eq("id", id);
            if (error) throw error;
            await refreshAdminMessages();
            loadPublicMessages();
            showToast("Pesan berhasil dihapus.", "success");
        } catch (error) { showToast(friendlyError(error, "Pesan belum berhasil dihapus."), "error"); }
        finally { setLoading(false); }
    }

    async function refreshAdminMessages() {
        const { data, error } = await state.supabase.from("alumni_messages").select("*").order("is_published", { ascending: false }).order("display_order").order("created_at", { ascending: false });
        if (error) throw error;
        state.adminMessages = data || [];
        renderAdminMessages();
        renderAdminStats();
    }

    function renderAdminSettings() {
        $("#official-instagram").value = sanitizeInstagramHandle(state.settings.instagram_ikadis || "");
        const fields = $("#whatsapp-settings-fields");
        fields.innerHTML = Object.entries(WA_LABELS).map(([key, label]) => {
            const row = state.whatsappLinks.find(item => item.kategori_grup === key);
            return `<label class="field"><span>${escapeHTML(label)}</span><input type="url" name="wa-setting" data-wa-category="${escapeAttr(key)}" value="${escapeAttr(row?.url_link || "")}" placeholder="https://chat.whatsapp.com/..."></label>`;
        }).join("");
    }

    async function saveInstagramSetting(event) {
        event.preventDefault();
        const handle = sanitizeInstagramHandle($("#official-instagram").value);
        if (!isValidInstagramHandle(handle)) { showToast("Nama akun Instagram IKADIS belum valid.", "error"); return; }
        setLoading(true, "Menyimpan Instagram resmi...");
        try {
            const { error } = await state.supabase.from("site_settings").upsert({ setting_key: "instagram_ikadis", setting_value: handle, is_public: true, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
            if (error) throw error;
            state.settings.instagram_ikadis = handle;
            applyPublicSettings(state.settings);
            showToast("Instagram resmi IKADIS berhasil diperbarui.", "success");
        } catch (error) { showToast(friendlyError(error, "Instagram resmi belum berhasil disimpan."), "error"); }
        finally { setLoading(false); }
    }

    async function saveWhatsappSettings(event) {
        event.preventDefault();
        const rows = $$('[name="wa-setting"]').map(input => ({ kategori_grup: input.dataset.waCategory, url_link: input.value.trim() || null }));
        if (rows.some(row => row.url_link && !/^https:\/\//i.test(row.url_link))) { showToast("Semua tautan WhatsApp harus diawali https://", "error"); return; }
        setLoading(true, "Menyimpan tautan WhatsApp...");
        try {
            const { error } = await state.supabase.from("whatsapp_links").upsert(rows, { onConflict: "kategori_grup" });
            if (error) throw error;
            state.whatsappLinks = rows;
            showToast("Tautan WhatsApp berhasil diperbarui.", "success");
        } catch (error) { showToast(friendlyError(error, "Tautan WhatsApp belum berhasil disimpan."), "error"); }
        finally { setLoading(false); }
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        window.setTimeout(() => $("input, textarea, button", modal)?.focus(), 20);
        renderIcons();
    }

    function closeModal(id) {
        document.getElementById(id)?.classList.add("hidden");
        if (!$(".modal:not(.hidden)")) document.body.style.overflow = "";
    }

    function openConfirm(text, action) {
        $("#confirm-text").textContent = text;
        state.confirmAction = action;
        openModal("confirm-modal");
    }

    function setLoading(show, text = "Memproses...") {
        $("#loading-text").textContent = text;
        $("#loading-overlay").classList.toggle("hidden", !show);
    }

    function sharePortalToWhatsapp() {
        const text = "Mari bergabung dan terhubung kembali dengan keluarga besar alumni Diponegoro Surakarta melalui Portal Alumni IKADIS: ";
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + location.origin + location.pathname)}`, "_blank", "noopener,noreferrer");
    }

    function showToast(message, type = "info", duration = 4500) {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        const icon = type === "success" ? "circle-check" : type === "error" ? "circle-alert" : "info";
        toast.innerHTML = `<i data-lucide="${icon}"></i><div>${escapeHTML(message)}</div>`;
        $("#toast-region").appendChild(toast);
        renderIcons();
        window.setTimeout(() => toast.remove(), duration);
    }

    function clearInvalidFields(root) { $$(".invalid", root).forEach(field => field.classList.remove("invalid")); }
    function isValidPhone(value) { return /^\+?[0-9]{8,15}$/.test(String(value).replace(/[\s()-]/g, "")); }
    function normalizePhone(value) { return String(value).replace(/[^0-9+]/g, ""); }
    function sanitizeInstagramHandle(value) { return String(value || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0].trim(); }
    function isValidInstagramHandle(value) { return /^[A-Za-z0-9._]{1,30}$/.test(sanitizeInstagramHandle(value)); }
    function instagramProfileUrl(handle) { return `https://www.instagram.com/${encodeURIComponent(sanitizeInstagramHandle(handle))}/`; }
    function ageRangeIndex(age) { if (["17-20", "21-25", "26-30"].includes(age)) return 1; if (["31-35", "36-40", "41-45"].includes(age)) return 2; if (["46-50", "51-55", "56-60"].includes(age)) return 3; return 4; }
    function getInitials(value) { return String(value || "IK").split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase(); }
    function formatNumber(value) { return new Intl.NumberFormat("id-ID").format(Number(value || 0)); }
    function formatDate(value) { if (!value) return "Tanggal belum dicantumkan"; return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`)); }
    function formatDateTime(value) { if (!value) return "-"; return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
    function friendlyError(error, fallback) { const message = String(error?.message || ""); if (/row-level security|permission denied/i.test(message)) return `${fallback} Hak akses basis data belum sesuai; jalankan SQL konfigurasi yang disertakan.`; if (/network|fetch/i.test(message)) return `${fallback} Periksa koneksi internet.`; return message || fallback; }
    function escapeHTML(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
    function escapeAttr(value) { return escapeHTML(value).replace(/`/g, "&#96;"); }
})();

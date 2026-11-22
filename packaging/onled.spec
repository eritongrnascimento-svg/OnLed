%global debug_package %{nil}
Name:           onled
Version:        1.1.0
Release:        1%{?dist}
Summary:        Controle de iluminação do teclado
License:        GPL-3.0-only
URL:            https://github.com/eritongrnascimento-svg/OnLed
BuildArch:      noarch
Requires:       gjs, gtk4, python3, polkit, systemd
Requires:       /usr/bin/sha256sum, /usr/bin/cut

%description
Controle da retroiluminação e dos LEDs de teclado expostos pelo Linux.

%install
install -Dm755 "%{project_dir}/packaging/onled" "%{buildroot}%{_bindir}/onled"
install -Dm755 "%{project_dir}/src/onled-helper" "%{buildroot}%{_libexecdir}/onled-helper"
install -Dm755 "%{project_dir}/packaging/onled-migrate" "%{buildroot}%{_libexecdir}/onled-migrate"
install -Dm644 "%{project_dir}/src/window.js" "%{buildroot}%{_datadir}/onled/window.js"
install -Dm644 "%{project_dir}/packaging/onled.desktop" "%{buildroot}%{_datadir}/applications/org.onled.Keyboard.desktop"
install -Dm644 "%{project_dir}/packaging/org.onled.Keyboard.metainfo.xml" "%{buildroot}%{_metainfodir}/org.onled.Keyboard.metainfo.xml"
install -Dm644 "%{project_dir}/packaging/org.onled.Keyboard.policy" "%{buildroot}%{_datadir}/polkit-1/actions/org.onled.Keyboard.policy"
install -Dm644 "%{project_dir}/packaging/onled.service" "%{buildroot}%{_unitdir}/onled.service"
install -Dm644 "%{project_dir}/packaging/onled.png" "%{buildroot}%{_datadir}/icons/hicolor/512x512/apps/onled.png"
install -Dm644 "%{project_dir}/README.md" "%{buildroot}%{_docdir}/onled/README.md"
install -Dm644 "%{project_dir}/LICENSE" "%{buildroot}%{_licensedir}/onled/LICENSE"

%post
/usr/libexec/onled-migrate

%preun
if [ "$1" -eq 0 ] && [ -d /run/systemd/system ]; then
    systemctl disable --now onled.service || :
fi

%postun
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || :
fi

%files
%{_bindir}/onled
%{_libexecdir}/onled-helper
%{_libexecdir}/onled-migrate
%{_datadir}/onled/
%{_datadir}/applications/org.onled.Keyboard.desktop
%{_metainfodir}/org.onled.Keyboard.metainfo.xml
%{_datadir}/polkit-1/actions/org.onled.Keyboard.policy
%{_unitdir}/onled.service
%{_datadir}/icons/hicolor/512x512/apps/onled.png
%doc %{_docdir}/onled/
%license %{_licensedir}/onled/

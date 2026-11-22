#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
out=$(realpath -m "${1:-$root/dist}")
mkdir -p "$out"
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
deb="$stage/deb"
install -Dm755 "$root/packaging/onled" "$deb/usr/bin/onled"
install -Dm755 "$root/src/onled-helper" "$deb/usr/libexec/onled-helper"
install -Dm755 "$root/packaging/onled-migrate" "$deb/usr/libexec/onled-migrate"
install -Dm644 "$root/src/window.js" "$deb/usr/share/onled/window.js"
install -Dm644 "$root/packaging/onled.desktop" "$deb/usr/share/applications/org.onled.Keyboard.desktop"
install -Dm644 "$root/packaging/org.onled.Keyboard.metainfo.xml" "$deb/usr/share/metainfo/org.onled.Keyboard.metainfo.xml"
install -Dm644 "$root/packaging/org.onled.Keyboard.policy" "$deb/usr/share/polkit-1/actions/org.onled.Keyboard.policy"
install -Dm644 "$root/packaging/onled.service" "$deb/usr/lib/systemd/system/onled.service"
install -Dm644 "$root/packaging/onled.png" "$deb/usr/share/icons/hicolor/512x512/apps/onled.png"
install -Dm644 "$root/README.md" "$deb/usr/share/doc/onled/README.md"
install -Dm644 "$root/LICENSE" "$deb/usr/share/doc/onled/copyright"

mkdir -p "$deb/DEBIAN"
cat > "$deb/DEBIAN/control" <<'CONTROL'
Package: onled
Version: 1.1.0
Section: utils
Priority: optional
Architecture: all
Maintainer: Ériton do Nascimento <eritongrnascimento-svg@users.noreply.github.com>
Depends: gjs, gir1.2-gtk-4.0, python3 (>= 3.9), pkexec | policykit-1, systemd
Homepage: https://github.com/eritongrnascimento-svg/OnLed
Description: Controle de iluminação do teclado
 Liga, apaga e mantém a retroiluminação e LEDs de teclado compatíveis.
CONTROL
cat > "$deb/DEBIAN/postinst" <<'SCRIPT'
#!/bin/sh
set -e
if [ "$1" = configure ]; then
    /usr/libexec/onled-migrate
fi
SCRIPT
cat > "$deb/DEBIAN/prerm" <<'SCRIPT'
#!/bin/sh
if [ "$1" = remove ] && [ -d /run/systemd/system ]; then
    systemctl disable --now onled.service || :
fi
SCRIPT
cat > "$deb/DEBIAN/postrm" <<'SCRIPT'
#!/bin/sh
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || :
fi
SCRIPT
chmod 755 "$deb/DEBIAN/"{postinst,prerm,postrm}
dpkg-deb --root-owner-group -Zxz --build "$deb" "$out/onled_1.1.0_all.deb"

rpmbuild -bb "$root/packaging/onled.spec" \
    --define "_topdir $stage/rpm" --define "_tmppath $stage" \
    --define "_rpmdir $out" --define "_build_name_fmt %{NAME}-%{VERSION}-%{RELEASE}.%{ARCH}.rpm" \
    --define "project_dir $root"

if [ "$#" -ge 3 ]; then
    runtime=$(realpath "$2")
    notices=$(realpath "$3")
    image="$stage/AppDir"
    mkdir -p "$image"
    install -m755 "$root/packaging/AppRun" "$image/AppRun"
    install -m644 "$root/packaging/onled.desktop" "$image/onled.desktop"
    install -m644 "$root/packaging/onled.png" "$image/onled.png"
    install -Dm644 "$root/packaging/onled.png" "$image/usr/share/icons/hicolor/512x512/apps/onled.png"
    ln -s onled.png "$image/.DirIcon"
    install -Dm644 "$root/src/window.js" "$image/usr/share/onled/window.js"
    install -Dm755 "$root/src/onled-helper" "$image/usr/libexec/onled-helper"
    install -Dm644 "$root/LICENSE" "$image/usr/share/doc/onled/LICENSE"
    install -Dm644 "$root/README.md" "$image/usr/share/doc/onled/README.md"
    mkdir -p "$image/usr/share/doc/onled/runtime"
    for notice in "$notices"/*; do
        install -m644 "$notice" "$image/usr/share/doc/onled/runtime/"
    done
    mksquashfs "$image" "$stage/image.squashfs" -all-root -noappend -no-xattrs -comp zstd -processors 2 -no-progress
    cat "$runtime" "$stage/image.squashfs" > "$out/OnLed-1.1.0-x86_64.AppImage"
    chmod 755 "$out/OnLed-1.1.0-x86_64.AppImage"
fi

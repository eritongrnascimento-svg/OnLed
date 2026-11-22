// SPDX-License-Identifier: GPL-3.0-only
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {exit} from 'system';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
const helper = '/usr/libexec/onled-helper';
const appDir = GLib.getenv('ONLED_APPDIR');
const app = new Gtk.Application({application_id: 'org.onled.Keyboard'});
let window;

const css = `
.hero { padding:22px; border-radius:16px; background:alpha(@theme_selected_bg_color,.13); }
.hero-icon { color:@theme_selected_bg_color; }
.title { font-size:25px; font-weight:800; }
.panel { padding:14px 16px; border-radius:14px; border:1px solid alpha(@theme_fg_color,.14); background:@theme_base_color; }
.section { font-weight:700; }
.muted { opacity:.74; }
`;

function box(horizontal = false, spacing = 8) {
    return new Gtk.Box({orientation: horizontal ? Gtk.Orientation.HORIZONTAL : Gtk.Orientation.VERTICAL, spacing});
}

function label(text, style = '') {
    const item = new Gtk.Label({label: text, xalign: 0, wrap: true});
    if (style)
        item.add_css_class(style);
    return item;
}

function button(text, handler, style = '') {
    const item = new Gtk.Button({label: text});
    if (style)
        item.add_css_class(style);
    item.connect('clicked', handler);
    return item;
}

async function command(argv) {
    const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [stdout, stderr] = await process.communicate_utf8_async(null, null);
    if (!process.get_successful()) {
        if (stdout.trim()) {
            const reply = JSON.parse(stdout);
            throw new Error(reply.errors?.join('; ') || 'Operação recusada.');
        }
        throw new Error(stderr.trim() || 'Operação recusada.');
    }
    return stdout.trim();
}

function deviceLabel(name) {
    if (name.endsWith('::scrolllock'))
        return 'Scroll Lock · ' + name.split('::')[0];
    return name.endsWith('kbd_backlight') ? 'Retroiluminação · ' + name : name;
}

function installedLauncher() {
    return GLib.file_test('/usr/bin/onled', GLib.FileTest.IS_EXECUTABLE);
}

function makeWindow() {
    const win = new Gtk.ApplicationWindow({application: app, title: 'OnLed', icon_name: 'onled',
        default_width: 650, default_height: 580});
    win.set_titlebar(new Gtk.HeaderBar());
    const page = box(false, 12);
    page.margin_top = page.margin_bottom = 18;
    page.margin_start = page.margin_end = 22;
    const scroll = new Gtk.ScrolledWindow({hscrollbar_policy: Gtk.PolicyType.NEVER});
    scroll.set_child(page);
    win.set_child(scroll);

    const hero = box(true, 16);
    hero.add_css_class('hero');
    const icon = new Gtk.Image({icon_name: 'input-keyboard-symbolic', pixel_size: 42});
    icon.add_css_class('hero-icon');
    const title = box(false, 4);
    title.append(label('Iluminação do teclado', 'title'));
    title.append(label('Controle os LEDs e a retroiluminação detectados pelo Linux.', 'muted'));
    hero.append(icon);
    hero.append(title);
    page.append(hero);

    const controls = box(false, 10);
    controls.add_css_class('panel');
    const deviceText = label('Procurando teclados…', 'section');
    controls.append(deviceText);
    const devices = new Gtk.StringList();
    const selector = new Gtk.DropDown({model: devices, hexpand: true});
    controls.append(selector);
    const level = new Gtk.Scale({orientation: Gtk.Orientation.HORIZONTAL, draw_value: true, digits: 0,
        adjustment: new Gtk.Adjustment({lower: 0, upper: 1, step_increment: 1, page_increment: 1})});
    controls.append(level);
    const actions = box(true, 8);
    const on = button('Ligar todos', () => change(['set', '*', 'max']), 'suggested-action');
    const off = button('Apagar todos', () => change(['set', '*', '0']));
    const apply = button('Aplicar brilho', () => {
        const device = current[selector.selected];
        if (device)
            void change(['set', device.name, String(Math.round(level.get_value()))]);
    });
    actions.append(on);
    actions.append(off);
    actions.append(apply);
    controls.append(actions);
    page.append(controls);

    const automatic = box(true, 14);
    automatic.add_css_class('panel');
    const autoText = box(false, 4);
    autoText.hexpand = true;
    autoText.append(label('Manter iluminação ligada', 'section'));
    autoText.append(label('Reacende os LEDs a cada 5 segundos, inclusive com a janela fechada.', 'muted'));
    const auto = button('Ativar', () => change(['automatic', service ? 'off' : 'on']));
    auto.valign = Gtk.Align.CENTER;
    automatic.append(autoText);
    automatic.append(auto);
    page.append(automatic);

    const startup = new Gtk.CheckButton({label: 'Abrir minimizado ao entrar na sessão'});
    const startupDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart']);
    const startupPath = GLib.build_filenamev([startupDir, 'onled-autostart.desktop']);
    startup.active = GLib.file_test(startupPath, GLib.FileTest.IS_REGULAR);
    startup.sensitive = installedLauncher();
    startup.connect('toggled', () => {
        try {
            if (startup.active) {
                if (GLib.mkdir_with_parents(startupDir, 0o700) !== 0)
                    throw new Error('Não foi possível preparar a inicialização automática.');
                GLib.file_set_contents(startupPath, '[Desktop Entry]\nType=Application\nName=OnLed\nExec=/usr/bin/onled --minimized\nIcon=onled\nTerminal=false\n');
            } else if (GLib.file_test(startupPath, GLib.FileTest.EXISTS)) {
                Gio.File.new_for_path(startupPath).delete(null);
            }
        } catch (error) {
            status.label = error.message;
        }
    });
    page.append(startup);

    const footer = box(true, 10);
    const spinner = new Gtk.Spinner();
    footer.append(spinner);
    const status = label('', 'muted');
    status.hexpand = true;
    footer.append(status);
    const reload = button('Atualizar', () => refresh());
    footer.append(reload);
    page.append(footer);

    const installed = GLib.file_test(helper, GLib.FileTest.IS_EXECUTABLE);
    const reader = installed ? helper : appDir ? appDir + helper : helper;
    let current = [];
    let service = false;
    let working = false;

    function updateSlider() {
        const chosen = current[selector.selected];
        level.set_range(0, chosen?.max || 1);
        level.set_value(chosen?.value || 0);
        level.sensitive = apply.sensitive = installed && !working && Boolean(chosen);
    }

    function busy(value) {
        working = value;
        spinner.spinning = value;
        reload.sensitive = !value;
        selector.sensitive = !value && current.length > 0;
        on.sensitive = off.sensitive = installed && !value && current.length > 0;
        auto.sensitive = installed && !value && (service || current.length > 0);
        updateSlider();
    }

    async function readDevices() {
        const result = JSON.parse(await command([reader, 'list']));
        const previous = current[selector.selected]?.name;
        current = result.devices;
        service = result.automatic;
        devices.splice(0, devices.get_n_items(), current.map(device => deviceLabel(device.name)));
        const index = current.findIndex(device => device.name === previous);
        if (current.length)
            selector.selected = Math.max(index, 0);
        deviceText.label = current.length === 1 ? '1 LED de teclado detectado'
            : current.length ? `${current.length} LEDs de teclado detectados` : 'Nenhum LED compatível detectado';
        auto.label = service ? 'Desativar' : 'Ativar';
    }

    async function refresh() {
        busy(true);
        try {
            await readDevices();
            status.label = installed ? (service ? 'Iluminação automática ativa.' : 'Pronto.')
                : 'Instale o DEB ou RPM para habilitar o controle. A detecção está disponível.';
        } catch (error) {
            status.label = error.message;
        } finally {
            busy(false);
        }
    }

    async function change(args) {
        busy(true);
        status.label = 'Aplicando alteração…';
        try {
            const output = await command(['/usr/bin/pkexec', '--disable-internal-agent', helper, ...args]);
            await readDevices();
            const errors = output ? JSON.parse(output).errors : [];
            status.label = errors.length ? 'Alteração parcial. ' + errors.join('; ') : 'Alteração aplicada.';
        } catch (error) {
            status.label = error.message;
        } finally {
            busy(false);
        }
    }

    selector.connect('notify::selected', updateSlider);
    void refresh();
    return win;
}

app.connect('activate', () => {
    if (!window) {
        if (appDir) {
            const icons = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            icons.add_search_path(appDir + '/usr/share/icons/hicolor/512x512/apps');
        }
        const provider = new Gtk.CssProvider();
        provider.load_from_data(css, -1);
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        window = makeWindow();
        window.connect('destroy', () => { window = null; });
    }
    window.present();
    if (ARGV.includes('--minimized'))
        window.minimize();
});

exit(app.run([]));

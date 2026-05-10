(function() {
    var THEME_KEY = 'unmatched-theme';

    function getTheme() {
        var saved = localStorage.getItem(THEME_KEY);
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.classList.toggle('dark-theme', theme === 'dark');
        updateButtons();
    }

    function toggleTheme() {
        var isDark = document.documentElement.classList.contains('dark-theme');
        var newTheme = isDark ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, newTheme);
        applyTheme(newTheme);
    }

    function updateButtons() {
        var isDark = document.documentElement.classList.contains('dark-theme');
        document.querySelectorAll('.theme-toggle').forEach(function(btn) {
            btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
            btn.title = isDark ? '\u0421\u0432\u0435\u0442\u043B\u0430\u044F \u0442\u0435\u043C\u0430' : '\u0422\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430';
        });
    }

    applyTheme(getTheme());

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem(THEME_KEY)) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.theme-toggle').forEach(function(btn) {
            btn.addEventListener('click', toggleTheme);
        });
        updateButtons();
    });
})();

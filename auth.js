// Генерация уникального ID пользователя
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Получение или создание ID пользователя
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// Проверка авторизации при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const userId = getUserId();
    
    // Если пользователь уже авторизован, перенаправляем на страницу настроек
    if (username) {
        console.log('Пользователь уже авторизован:', username, userId);
        window.location.href = 'setup.html';
        return;
    }
    
    // Обработка формы авторизации
    const authForm = document.getElementById('authForm');
    const usernameInput = document.getElementById('username');
    
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        
        if (username.length < 2) {
            alert('Имя должно содержать минимум 2 символа');
            return;
        }
        
        if (username.length > 20) {
            alert('Имя должно содержать максимум 20 символов');
            return;
        }
        
        // Сохраняем имя пользователя и ID
        localStorage.setItem('username', username);
        localStorage.setItem('userId', userId);
        localStorage.setItem('loginTime', new Date().toISOString());
        
        console.log('Пользователь авторизован:', username, userId);
        
        // Перенаправляем на страницу настроек
        window.location.href = 'setup.html';
    });
    
    // Автофокус на поле ввода
    usernameInput.focus();
});

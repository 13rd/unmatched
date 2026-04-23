const socket = io();

const params = new URLSearchParams(window.location.search);
const roomParam = params.get('room');

if (roomParam) {
    document.getElementById('joinSection').style.display = 'block';
    document.getElementById('roomCodeInput').value = roomParam.toUpperCase();
}

document.getElementById('createRoom').addEventListener('click', () => {
    socket.emit('createRoom', (data) => {
        if (data.roomId) {
            window.location.href = `index.html?room=${data.roomId}`;
        }
    });
});

document.getElementById('joinRoom').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (roomCode.length !== 6) {
        alert('Введите корректный код комнаты (6 символов)');
        return;
    }
    socket.emit('joinRoom', roomCode);
});

socket.on('roomJoined', (data) => {
    window.location.href = `index.html?room=${data.roomId}`;
});

socket.on('error', (data) => {
    alert(data.message);
});
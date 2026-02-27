// js/main.js

const loginForm = document.getElementById('login-form');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

// Lógica de Login (Simulada)
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    renderCalendar(); 
});

// Logout
logoutBtn.addEventListener('click', () => {
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});

// Alternar Tema
themeToggleBtn.addEventListener('click', () => {
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggleBtn.innerHTML = isDark ? '<i class="ph ph-moon"></i>' : '<i class="ph ph-sun"></i>';
});

// Navegação entre Telas
const menuButtons = document.querySelectorAll('.menu-btn');
const sections = document.querySelectorAll('.view-section');

menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-view');
        
        // Remove active de todos
        menuButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Esconde todas as sections
        sections.forEach(s => s.classList.add('hidden'));
        document.getElementById(target).classList.remove('hidden');
    });
});

// Cálculo Automático de Hora do Fim do Trabalho
const startTimeInput = document.getElementById('party-start-time');
const hoursInput = document.getElementById('party-hours');
const endTimeInput = document.getElementById('party-end-time');

function calculateEndTime() {
    if (startTimeInput && hoursInput && endTimeInput) {
        if (startTimeInput.value && hoursInput.value) {
            // Separa a hora e os minutos iniciais
            const [hours, minutes] = startTimeInput.value.split(':').map(Number);
            const duration = parseFloat(hoursInput.value);
            
            // Separa a duração em horas inteiras e fração de minutos
            const durationHours = Math.floor(duration);
            const durationMinutes = Math.round((duration - durationHours) * 60);

            let endHours = hours + durationHours;
            let endMinutes = minutes + durationMinutes;

            // Se os minutos passarem de 60, ajusta a hora
            if (endMinutes >= 60) {
                endHours += Math.floor(endMinutes / 60);
                endMinutes = endMinutes % 60;
            }

            // Garante que o formato seja de 24h (Ex: 25h vira 01h da manhã)
            endHours = endHours % 24; 

            // Formata para manter 2 dígitos (Ex: "09", "00")
            const formattedHours = String(endHours).padStart(2, '0');
            const formattedMinutes = String(endMinutes).padStart(2, '0');

            endTimeInput.value = `${formattedHours}:${formattedMinutes}`;
        } else {
            // Limpa o campo se algum dos dados for apagado
            endTimeInput.value = '';
        }
    }
}

// Adiciona os eventos para calcular sempre que digitar ou mudar algo
if (startTimeInput && hoursInput) {
    startTimeInput.addEventListener('input', calculateEndTime);
    hoursInput.addEventListener('input', calculateEndTime);
}

// Função para renderizar calendário (Mock visual)
function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    if(!calendarDays) return;
    calendarDays.innerHTML = '';
    for (let i = 1; i <= 31; i++) {
        const day = document.createElement('div');
        day.classList.add('cal-day', 'border-grey');
        day.textContent = i;
        calendarDays.appendChild(day);
    }
}
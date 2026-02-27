// js/main.js

import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { addFesta, getFestas, updateFesta, deleteFesta } from './db-festas.js';
import { addEquipamento, getEquipamentos, deleteEquipamento } from './db-equipamentos.js'; 

const loginForm = document.getElementById('login-form');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

const partyModal = document.getElementById('modal-party-details');
const editModal = document.getElementById('modal-edit-party');
const closeModalBtn = document.getElementById('close-modal');
const closeEditModalBtn = document.getElementById('close-modal-edit');

let dataAtualCalendario = new Date();
let festasGlobais = [];
let equipamentosGlobais = []; 

const filterStatus = document.getElementById('filter-status');
const filterMonth = document.getElementById('filter-month');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        await carregarEquipamentos(); 
        await carregarDadosGlobais();
    } else {
        appContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const btnLogin = document.getElementById('btn-login');
    
    btnLogin.textContent = "Verificando...";
    btnLogin.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error(error);
        alert("Acesso Negado: Verifique seu e-mail ou senha.");
    } finally {
        btnLogin.textContent = "Entrar";
        btnLogin.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

themeToggleBtn.addEventListener('click', () => {
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggleBtn.innerHTML = isDark ? '<i class="ph ph-moon"></i>' : '<i class="ph ph-sun"></i>';
});

const menuButtons = document.querySelectorAll('.menu-btn');
const sections = document.querySelectorAll('.view-section');

menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-view');
        menuButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sections.forEach(s => s.classList.add('hidden'));
        document.getElementById(target).classList.remove('hidden');
    });
});

function setupCalculoHoras(inputIdStart, inputIdHours, inputIdEnd) {
    const startInput = document.getElementById(inputIdStart);
    const hoursInput = document.getElementById(inputIdHours);
    const endInput = document.getElementById(inputIdEnd);

    function calc() {
        if (startInput.value && hoursInput.value) {
            const [hours, minutes] = startInput.value.split(':').map(Number);
            const duration = parseFloat(hoursInput.value);
            const durationHours = Math.floor(duration);
            const durationMinutes = Math.round((duration - durationHours) * 60);

            let endHours = hours + durationHours;
            let endMinutes = minutes + durationMinutes;

            if (endMinutes >= 60) {
                endHours += Math.floor(endMinutes / 60);
                endMinutes = endMinutes % 60;
            }
            endHours = endHours % 24; 
            endInput.value = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
        } else { endInput.value = ''; }
    }
    if (startInput && hoursInput) {
        startInput.addEventListener('input', calc);
        hoursInput.addEventListener('input', calc);
    }
}
setupCalculoHoras('party-start-time', 'party-hours', 'party-end-time');
setupCalculoHoras('edit-party-start-time', 'edit-party-hours', 'edit-party-end-time');

// ========================================================
// CARREGAR EQUIPAMENTOS 
// ========================================================
async function carregarEquipamentos() {
    try {
        equipamentosGlobais = await getEquipamentos();
        
        const listaContainer = document.getElementById('equipments-list-container');
        listaContainer.innerHTML = '';
        
        if (equipamentosGlobais.length === 0) {
            listaContainer.innerHTML = '<p style="color: var(--text-muted);">Nenhum equipamento cadastrado ainda.</p>';
        } else {
            equipamentosGlobais.forEach(eq => {
                const item = document.createElement('div');
                item.className = 'equip-item';
                item.innerHTML = `
                    <div class="equip-info">
                        <strong><i class="ph ph-speaker-hifi"></i> ${eq.nome}</strong>
                        <span>R$ ${Number(eq.valorSugerido).toFixed(2).replace('.', ',')} (Sugerido)</span>
                    </div>
                    <button onclick="window.excluirEquipamento('${eq.id}')" class="btn-delete-icon" title="Excluir Equipamento">
                        <i class="ph ph-trash"></i>
                    </button>
                `;
                listaContainer.appendChild(item);
            });
        }

        const selectAdd = document.getElementById('party-eq');
        const selectEdit = document.getElementById('edit-party-eq');
        
        let optionsHtml = '<option value="" disabled selected>Selecione o equipamento...</option>';
        
        equipamentosGlobais.forEach(eq => {
            optionsHtml += `<option value="${eq.nome}">${eq.nome}</option>`;
        });

        selectAdd.innerHTML = optionsHtml;
        selectEdit.innerHTML = optionsHtml;

    } catch (error) {
        console.error("Erro ao carregar equipamentos", error);
    }
}

window.excluirEquipamento = async function(id) {
    if(confirm("Deseja realmente excluir este equipamento? Ele desaparecerá da lista de opções para novos agendamentos.")) {
        try {
            await deleteEquipamento(id);
            await carregarEquipamentos(); 
        } catch(e) {
            alert("Erro ao excluir.");
        }
    }
}

const formAddEq = document.getElementById('form-add-equipment');
if(formAddEq) {
    formAddEq.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nomeEq = document.getElementById('eq-name').value;
        const valorEq = parseFloat(document.getElementById('eq-value').value);

        const btnSubmit = formAddEq.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        try {
            await addEquipamento({ nome: nomeEq, valorSugerido: valorEq });
            formAddEq.reset();
            await carregarEquipamentos(); 
        } catch (error) {
            alert("Erro ao salvar equipamento.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="ph ph-floppy-disk"></i> Cadastrar Equipamento`;
        }
    });
}


// ========================================================
// CARREGAR E RENDERIZAR FESTAS
// ========================================================
async function carregarDadosGlobais() {
    try {
        festasGlobais = await getFestas();

        let qtdAgendadas = 0, qtdRealizadas = 0, valorReceber = 0, valorRecebido = 0;
        festasGlobais.forEach(festa => {
            const valorSeguro = Number(festa.valor) || 0;
            if (festa.status === 'agendada') {
                qtdAgendadas++; valorReceber += valorSeguro;
            } else if (festa.status === 'concluida') {
                qtdRealizadas++; valorRecebido += valorSeguro;
            }
        });

        document.getElementById('count-agendadas').textContent = qtdAgendadas;
        document.getElementById('count-realizadas').textContent = qtdRealizadas;
        document.getElementById('val-pendente').textContent = `R$ ${valorReceber.toFixed(2).replace('.', ',')}`;
        document.getElementById('val-recebido').textContent = `R$ ${valorRecebido.toFixed(2).replace('.', ',')}`;

        popularFiltroMeses(festasGlobais);
        aplicarFiltrosNaLista();
        renderCalendar();
    } catch (error) {
        console.log(error);
    }
}

function popularFiltroMeses(festas) {
    const mesesExistentes = new Set();
    festas.forEach(f => {
        if(f.data) mesesExistentes.add(f.data.substring(0, 7)); 
    });

    const mesesOrdenados = Array.from(mesesExistentes).sort().reverse();
    filterMonth.innerHTML = '<option value="all">Todos os Meses</option>';
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    mesesOrdenados.forEach(anoMes => {
        const [ano, mes] = anoMes.split('-');
        const option = document.createElement('option');
        option.value = anoMes;
        option.textContent = `${nomesMeses[parseInt(mes) - 1]} / ${ano}`;
        filterMonth.appendChild(option);
    });
}

function aplicarFiltrosNaLista() {
    const statusSel = filterStatus.value;
    const mesSel = filterMonth.value;

    const festasFiltradas = festasGlobais.filter(f => {
        if (!f.data) return false;
        const passaStatus = (statusSel === 'all' || f.status === statusSel);
        const passaMes = (mesSel === 'all' || f.data.startsWith(mesSel));
        return passaStatus && passaMes;
    });

    renderPartyList(festasFiltradas);
}

filterStatus.addEventListener('change', aplicarFiltrosNaLista);
filterMonth.addEventListener('change', aplicarFiltrosNaLista);

function renderPartyList(festas) {
    const listaContainer = document.getElementById('party-list-container');
    listaContainer.innerHTML = '';

    if(festas.length === 0) {
        listaContainer.innerHTML = '<p style="color: var(--text-muted);">Nenhuma festa encontrada para estes filtros.</p>';
        return;
    }

    festas.forEach(festa => {
        const [ano, mes, dia] = festa.data.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        const classeStatus = festa.status === 'concluida' ? 'status-completed' : 'status-scheduled';
        const badgeClass = festa.status === 'concluida' ? 'green' : 'blue';
        const textoStatus = festa.status === 'concluida' ? 'Concluída' : 'Agendada';
        const valorExibicao = Number(festa.valor) || 0;

        const card = document.createElement('div');
        card.className = `party-card ${classeStatus}`;
        card.innerHTML = `
            <div class="party-header">
                <h4><i class="ph ph-confetti"></i> ${festa.nome || 'Evento sem nome'}</h4>
                <span class="badge ${badgeClass}">${textoStatus}</span>
            </div>
            <div class="party-body">
                <div class="party-info-item">
                    <i class="ph ph-calendar-blank"></i>
                    <span><strong>${dataFormatada}</strong> (${festa.horaInicio || '--:--'} às ${festa.horaFim || '--:--'})</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-speaker-hifi"></i>
                    <span><strong>Equipamento:</strong> ${festa.equipamento || 'N/A'}</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-map-pin"></i>
                    <span><strong>Local:</strong> ${festa.endereco || 'N/A'}</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-user"></i>
                    <span><strong>Cliente:</strong> ${festa.cliente || 'N/A'} (${festa.whatsapp || 'Sem Whats'})</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-currency-circle-dollar"></i>
                    <span class="party-value-highlight">R$ ${valorExibicao.toFixed(2).replace('.', ',')}</span>
                </div>
            </div>
            <div style="margin-top: 15px; border-top: 1px dashed var(--border-color); padding-top: 15px; display:flex; gap: 10px;">
                 <button onclick="window.abrirModalEdicao('${festa.id}')" class="btn-action edit" style="max-width: 150px;"><i class="ph ph-pencil-simple"></i> Editar</button>
            </div>
        `;
        listaContainer.appendChild(card);
    });
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthLabel = document.getElementById('current-month');
    if(!calendarDays || !monthLabel) return;

    const ano = dataAtualCalendario.getFullYear();
    const mes = dataAtualCalendario.getMonth();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthLabel.textContent = `${monthNames[mes]} ${ano}`;
    
    const daysInMonth = new Date(ano, mes + 1, 0).getDate();
    const festasPorDia = {};
    festasGlobais.forEach(f => {
        if(!f.data) return;
        if(!festasPorDia[f.data]) festasPorDia[f.data] = [];
        festasPorDia[f.data].push(f);
    });

    calendarDays.innerHTML = '';
    
    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('cal-day'); 
        day.textContent = i;
        
        const mesStr = String(mes + 1).padStart(2, '0');
        const diaStr = String(i).padStart(2, '0');
        const dataBusca = `${ano}-${mesStr}-${diaStr}`;
        const festasDoDia = festasPorDia[dataBusca] || [];

        if (festasDoDia.length === 0) {
            day.classList.add('bg-grey'); 
        } else {
            if (festasDoDia.length > 1) {
                day.classList.add('bg-yellow'); 
            } else {
                if (festasDoDia[0].status === 'concluida') {
                    day.classList.add('bg-green'); 
                } else {
                    day.classList.add('bg-blue'); 
                }
            }
            day.addEventListener('click', () => abrirModalDetalhes(festasDoDia, dataBusca)); 
        }
        calendarDays.appendChild(day);
    }
}

document.getElementById('btn-prev-month').addEventListener('click', () => {
    dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() - 1);
    renderCalendar();
});
document.getElementById('btn-next-month').addEventListener('click', () => {
    dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + 1);
    renderCalendar();
});

function abrirModalDetalhes(festasDoDia, dataBusca) {
    const container = document.getElementById('modal-dynamic-content');
    container.innerHTML = ''; 
    
    const [ano, mes, dia] = dataBusca.split('-');
    document.getElementById('modal-title').textContent = `Eventos do dia ${dia}/${mes}/${ano}`;

    festasDoDia.forEach((festa, index) => {
        const bloco = document.createElement('div');
        bloco.className = 'modal-party-block';
        
        const numFesta = festasDoDia.length > 1 ? ` (Evento ${index + 1})` : '';
        let numeroWhats = (festa.whatsapp || '').replace(/\D/g, '');
        const enderecoMapeado = encodeURIComponent(festa.endereco || '');

        const btnConcluirHtml = festa.status === 'agendada' 
            ? `<button onclick="window.marcarConcluida('${festa.id}')" class="btn-action finish"><i class="ph ph-check-circle"></i> Concluir</button>`
            : `<span style="display:flex; align-items:center; gap:5px; color:var(--status-done); font-weight:bold; padding: 10px;"><i class="ph ph-check-circle"></i> Festa Realizada</span>`;

        bloco.innerHTML = `
            <h3><span><i class="ph ph-confetti"></i> ${festa.nome || 'Evento sem nome'} ${numFesta}</span></h3>
            <p><i class="ph ph-clock"></i> <strong>Horário:</strong> ${festa.horaInicio || '--:--'} às ${festa.horaFim || '--:--'}</p>
            <p><i class="ph ph-speaker-hifi"></i> <strong>Equipamento:</strong> ${festa.equipamento || 'N/A'}</p>
            <p><i class="ph ph-map-pin"></i> <strong>Local:</strong> ${festa.endereco || 'N/A'}</p>
            <p><i class="ph ph-user"></i> <strong>Cliente:</strong> ${festa.cliente || 'N/A'}</p>
            
            <div class="modal-actions">
                <a href="https://waze.com/ul?q=${enderecoMapeado}" target="_blank" class="btn-action waze"><i class="ph ph-navigation-arrow"></i> Waze</a>
                <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapeado}" target="_blank" class="btn-action maps"><i class="ph ph-map-pin"></i> Maps</a>
                <a href="https://wa.me/55${numeroWhats}" target="_blank" class="btn-action whats"><i class="ph ph-whatsapp-logo"></i> Whats</a>
            </div>
            
            <div class="modal-actions" style="border-top: none; padding-top: 0;">
                <button onclick="window.abrirModalEdicao('${festa.id}')" class="btn-action edit"><i class="ph ph-pencil-simple"></i> Editar</button>
                ${btnConcluirHtml}
                <button onclick="window.excluirFesta('${festa.id}')" class="btn-action delete"><i class="ph ph-trash"></i> Excluir</button>
            </div>
        `;
        container.appendChild(bloco);
    });

    partyModal.classList.remove('hidden');
}

closeModalBtn.addEventListener('click', () => { partyModal.classList.add('hidden'); });
closeEditModalBtn.addEventListener('click', () => { editModal.classList.add('hidden'); });
window.addEventListener('click', (e) => { 
    if (e.target === partyModal) partyModal.classList.add('hidden'); 
    if (e.target === editModal) editModal.classList.add('hidden'); 
});

window.marcarConcluida = async function(id) {
    if(confirm("Tem certeza que deseja marcar esta festa como concluída?")) {
        try {
            await updateFesta(id, { status: 'concluida' });
            partyModal.classList.add('hidden'); 
            await carregarDadosGlobais(); 
        } catch (error) {
            alert("Erro ao atualizar status.");
        }
    }
}

window.excluirFesta = async function(id) {
    if(confirm("ATENÇÃO: Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.")) {
        try {
            await deleteFesta(id);
            partyModal.classList.add('hidden'); 
            await carregarDadosGlobais(); 
        } catch (error) {
            alert("Erro ao excluir festa.");
        }
    }
}

window.abrirModalEdicao = function(id) {
    const festa = festasGlobais.find(f => f.id === id);
    if(!festa) return;

    partyModal.classList.add('hidden');
    editModal.classList.remove('hidden');

    document.getElementById('edit-party-id').value = festa.id;
    document.getElementById('edit-party-name').value = festa.nome || '';
    document.getElementById('edit-party-address').value = festa.endereco || '';
    document.getElementById('edit-party-eq').value = festa.equipamento || '';
    document.getElementById('edit-party-date').value = festa.data || '';
    document.getElementById('edit-party-start-time').value = festa.horaInicio || '';
    document.getElementById('edit-party-hours').value = festa.horas || '';
    document.getElementById('edit-party-end-time').value = festa.horaFim || '';
    document.getElementById('edit-client-name').value = festa.cliente || '';
    document.getElementById('edit-client-whatsapp').value = festa.whatsapp || '';
    document.getElementById('edit-party-value').value = festa.valor || '';
    document.getElementById('edit-party-staff').value = festa.equipe || '';
}

const formEditParty = document.getElementById('form-edit-party');
if(formEditParty) {
    formEditParty.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const idFesta = document.getElementById('edit-party-id').value;
        const dadosAtualizados = {
            nome: document.getElementById('edit-party-name').value,
            endereco: document.getElementById('edit-party-address').value,
            equipamento: document.getElementById('edit-party-eq').value,
            data: document.getElementById('edit-party-date').value,
            horaInicio: document.getElementById('edit-party-start-time').value,
            horas: document.getElementById('edit-party-hours').value,
            horaFim: document.getElementById('edit-party-end-time').value,
            cliente: document.getElementById('edit-client-name').value,
            whatsapp: document.getElementById('edit-client-whatsapp').value,
            valor: parseFloat(document.getElementById('edit-party-value').value),
            equipe: document.getElementById('edit-party-staff').value || ""
        };

        const btnSubmit = formEditParty.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Atualizando...";
        btnSubmit.disabled = true;

        try {
            await updateFesta(idFesta, dadosAtualizados);
            alert("Festa atualizada com sucesso!");
            editModal.classList.add('hidden');
            await carregarDadosGlobais();
        } catch (error) {
            alert("Erro ao atualizar os dados.");
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });
}

const formAddParty = document.getElementById('form-add-party');
if(formAddParty) {
    formAddParty.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const novaFesta = {
            nome: document.getElementById('party-name').value,
            endereco: document.getElementById('party-address').value,
            equipamento: document.getElementById('party-eq').value,
            data: document.getElementById('party-date').value,
            horaInicio: document.getElementById('party-start-time').value,
            horas: document.getElementById('party-hours').value,
            horaFim: document.getElementById('party-end-time').value,
            cliente: document.getElementById('client-name').value,
            whatsapp: document.getElementById('client-whatsapp').value,
            valor: parseFloat(document.getElementById('party-value').value),
            equipe: document.getElementById('party-staff').value || "",
            status: "agendada", 
            criadoEm: new Date().toISOString() 
        };

        const btnSubmit = formAddParty.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerHTML;
        btnSubmit.textContent = "Salvando...";
        btnSubmit.disabled = true;

        try {
            await addFesta(novaFesta);
            alert("Festa agendada com sucesso!");
            formAddParty.reset(); 
            document.getElementById('party-end-time').value = ''; 
            await carregarDadosGlobais();
            
            document.querySelector('.menu-btn[data-view="view-calendar"]').click();
        } catch (error) {
            alert("Erro ao salvar.");
        } finally {
            btnSubmit.innerHTML = textoOriginal;
            btnSubmit.disabled = false;
        }
    });
}
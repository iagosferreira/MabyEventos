// js/main.js

import { db, auth } from './firebase-init.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
const editEqModal = document.getElementById('modal-edit-equipment');

const closeModalBtn = document.getElementById('close-modal');
const closeEditModalBtn = document.getElementById('close-modal-edit');
const closeEditEqModalBtn = document.getElementById('close-modal-edit-eq');

let dataAtualCalendario = new Date();
let festasGlobais = [];
let equipamentosGlobais = []; 

const filterStatus = document.getElementById('filter-status');
const filterMonth = document.getElementById('filter-month');

// ========================================================
// SISTEMA DE NOTIFICAÇÕES E CONFIRMAÇÕES
// ========================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if(type === 'success') icon = '<i class="ph ph-check-circle"></i>';
    if(type === 'error') icon = '<i class="ph ph-warning-circle"></i>';
    if(type === 'info') icon = '<i class="ph ph-info"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3400); 
}

function customConfirm(message, onConfirm) {
    const confirmModal = document.getElementById('custom-confirm-modal');
    if(!confirmModal) {
        if(confirm(message)) onConfirm();
        return;
    }
    const msgEl = document.getElementById('confirm-message');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    if(msgEl) msgEl.textContent = message;
    confirmModal.classList.remove('hidden');

    const newBtnOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnCancel.addEventListener('click', () => { confirmModal.classList.add('hidden'); });
    newBtnOk.addEventListener('click', () => { confirmModal.classList.add('hidden'); onConfirm(); });
}
window.customConfirm = customConfirm;

function formatarCPFParaContrato(cpf) {
    if (!cpf) return '__________________';
    let num = cpf.replace(/\D/g, '');
    if (num.length === 11) {
        return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
}

function numeroPorExtenso(numero) {
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dezenas1 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas2 = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    function converterGrupo(n) {
        if (n === 100) return "cem";
        let str = "";
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;
        if (c > 0) str += centenas[c] + (d > 0 || u > 0 ? " e " : "");
        if (d === 1) str += dezenas1[u];
        else {
            if (d > 1) str += dezenas2[d] + (u > 0 ? " e " : "");
            if (u > 0 && d !== 1) str += unidades[u];
        }
        return str;
    }

    let reais = Math.floor(numero);
    let centavos = Math.round((numero - reais) * 100);
    let strReais = "";

    if (reais === 0) strReais = "zero reais";
    else {
        let milhares = Math.floor(reais / 1000);
        let resto = reais % 1000;
        if (milhares > 0) {
            strReais += (milhares === 1 ? "mil" : converterGrupo(milhares) + " mil");
            if (resto > 0) strReais += (resto < 100 || resto % 100 === 0 ? " e " : " ") + converterGrupo(resto);
        } else {
            strReais += converterGrupo(resto);
        }
        strReais += reais === 1 ? " real" : " reais";
    }

    let strCentavos = "";
    if (centavos > 0) {
        strCentavos = " e " + converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
    }

    return strReais + strCentavos;
}

// ========================================================
// GERADOR NATIVO DE WORD (.doc) DO CONTRATO
// ========================================================
window.gerarContratoWord = async function(idFesta) {
    const festa = festasGlobais.find(f => f.id === idFesta);
    if (!festa) return;

    showToast("Preparando contrato real (.docx), aguarde...", "info");

    const [ano, mes, dia] = festa.data.split('-');
    const dataFestaFormatada = `${dia}/${mes}/${ano}`;
    const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const dataAtual = new Date();
    const diaAtual = String(dataAtual.getDate()).padStart(2, '0');
    const dataAssinatura = `${diaAtual} de ${mesesExtenso[dataAtual.getMonth()]} de ${dataAtual.getFullYear()}`;

    const valorReaisStr = festa.valor.toFixed(2).replace('.', ',');
    const valorExtensoStr = numeroPorExtenso(festa.valor);

    let ruaContratante = (festa.rua || '').trim();
    let prefixoRua = /^rua\b|^av\b|^avenida\b|^rodovia\b|^estrada\b|^praça\b|^travessa\b/i.test(ruaContratante) ? "" : "Rua ";
    let cpfFormatado = formatarCPFParaContrato(festa.cpf);

    let equipArray = (festa.equipamento || "").split(',').map(e => e.trim().toLowerCase()).filter(e => e !== "");
    let txtEquips = [];
    
    let temAereo = equipArray.some(e => e.includes('aéreo') || e.includes('aereo'));
    let tem360Normal = equipArray.some(e => e.includes('360') && !e.includes('aéreo') && !e.includes('aereo'));
    let temCabine = equipArray.some(e => e.includes('cabine') || e.includes('foto'));
    let temAlbum = equipArray.some(e => e.includes('álbum') || e.includes('album'));

    if (temCabine) {
        let txt = "de fotos disponibilizadas pela CABINE FOTOGRÁFICA";
        if (temAlbum) txt += " + ÁLBUM";
        txtEquips.push(txt);
    }
    if (tem360Normal) {
        txtEquips.push("de gravação e edição e disponibilização de vídeos por meio do uso da plataforma de filmagem 360º intitulada PLATAFORMA 360");
    }
    if (temAereo) {
        txtEquips.push("de gravação e edição e disponibilização de vídeos por meio do uso da plataforma de filmagem 360º aéreo intitulada PLATAFORMA 360 AÉREO");
    }
    
    let outros = equipArray.filter(e => !e.includes('aéreo') && !e.includes('aereo') && !(e.includes('360') && !e.includes('aéreo') && !e.includes('aereo')) && !e.includes('cabine') && !e.includes('foto') && !e.includes('álbum') && !e.includes('album'));
    if (outros.length > 0) {
        txtEquips.push(`de locação e operação dos seguintes equipamentos: ${outros.join(', ')}`);
    }

    let textoEquipamentoFinal = txtEquips.join(" e ");
    if(textoEquipamentoFinal === "") textoEquipamentoFinal = "de prestação de serviços para o evento";

    let enderecoFinalFesta = festa.endereco || '__________________';

    const conteudoWordHtml = `
        <div style="font-family: Arial, sans-serif; font-size: 11pt; text-align: justify; line-height: 1.5;">
            <p style="text-align: center; font-weight: bold; font-size: 14pt;">
                CONTRATO DE PRESTAÇÃO DE SERVIÇO<br>DE PRODUÇÃO DE FOTO E VÍDEO
            </p>

            <p style="font-weight: bold; text-decoration: underline;">IDENTIFICAÇÃO DAS PARTES CONTRATANTES</p>
            <p><strong>CONTRATANTE:</strong> ${festa.cliente || '__________________'} inscrito no CPF/CNPJ: ${cpfFormatado}, sediada na ${prefixoRua}${ruaContratante || '__________________'}, Número: ${festa.numero || '___'}, Bairro: ${festa.bairro || '__________________'}, Cidade: ${festa.cidade || '__________________'}, Estado: ${festa.estado || '___'} e Cep: ${festa.cep || '_________'} cujo telefone para contato é: ${festa.whatsapp || '__________________'}</p>
            <p><strong>CONTRATADO:</strong> Denise Soraia Corrêa de Mattos inscrito no CNPJ/CPF nº 025 319 207-22, sediado à Rua: Bananal, número: 79, bairro: Santo Agostinho, cidade: Volta Redonda, estado: Rio de Janeiro, CEP: 27210720, telefone: (24)99987-3558, e-mail: denise.soraia@hotmail.com</p>

            <p>As partes acima acordam com o presente contrato que será regido pelas cláusulas abaixo:</p>

            <p style="font-weight: bold;">CLÁUSULA I - DO OBJETO DO CONTRATO:</p>
            <p>1.1 O objeto do presente contrato consiste na realização de serviços profissionais ${textoEquipamentoFinal}. O serviço terá a duração de ${festa.horas} horas e será realizado no dia ${dataFestaFormatada}, no seguinte endereço <span style="color: red;">${enderecoFinalFesta}</span>;</p>
            <p>1.2 Os vídeos gravados serão disponibilizados por meio de “QR Code” ou e-mail imediatamente após sua captação durante a realização do evento (se o local tiver sinal).</p>
            <p>Um arquivo digital com todos os vídeos gravados será disponibilizado em até 2 dias úteis após a finalização do evento.</p>
            <p>1.3 As fotos da cabine fotográfica serão impressas e/ou disponibilizadas por “Qr code” no evento.</p>
            <p>Um arquivo digital com todas as fotos será disponibilizado em até 2 dias úteis após a finalização do evento.</p>

            <p style="font-weight: bold;">CLÁUSULA II – DAS OBRIGAÇÕES DO CONTRATADO</p>
            <p>2.1 Fica o CONTRATADO obrigado a executar o serviço objeto deste contrato na data e horário acordado somente após a confirmação do pagamento previsto no item 4.1.</p>
            <p>2.2 O CONTRATADO deverá chegar ao local do evento no dia agendado com pelo menos 1 hora de antecedência do horário marcado para a abertura da festa.</p>
            <p>2.3 O CONTRATADO deverá, no dia da captação de imagens, seguir as recomendações da equipe contratante, para realização do seu trabalho cumprindo todas as normas de segurança previstas para o local do evento.</p>
            <p>2.5 Caso haja alguma falha no equipamento do CONTRATADO alheio a sua vontade e só perceptível após a execução do serviço, que acarrete perda total ou parcial do serviço prestado, fica o CONTRATADO obrigado a devolver a quantia proporcional a perda ocorrida, até o limite do valor contratado, ou poderá compensar o CONTRATANTE de outra maneira, na concordância das partes.</p>

            <p style="font-weight: bold;">CLÁUSULA III – DAS OBRIGAÇÕES DO CONTRATANTE</p>
            <p>3.1 O CONTRATANTE deverá disponibilizar uma pessoa no dia do evento para receber o CONTRATADO, informar exatamente o local correto onde a plataforma 360º e a cabine fotográfica deverão ser instaladas e fornecer todo o apoio necessário para que os equipamentos sejam montados adequadamente.</p>
            <p>3.2 O CONTRATANTE deverá disponibilizar local seguro para o CONTRATADO poder manipular o equipamento necessário à realização do trabalho.</p>
            <p>3.3 O CONTRATANTE deverá fornecer ao CONTRATADO todas as informações necessárias para à realização do serviço objeto deste contrato tais como: nome legível e identificação das pessoas de destaque; preferências musicais e músicas escolhidas (edição de vídeo); livre acesso da equipe ao local do evento; verificar a existência de pontos de energia para os equipamentos (iluminação, câmera, carregadores de bateria, etc.).</p>
            <p>3.4 Em locais escolhidos para a captação que cobrarem taxa de locação, fica a cargo do CONTRATANTE tais despesas. Caso o local da captação seja a uma distância superior a 100 quilômetros (ida e volta), fica a cargo do contratante as despesas com transporte, bem como de hospedagem e alimentação para o CONTRATADO e equipe, caso necessário.</p>

            <p style="font-weight: bold;">CLÁUSULA IV – DO VALOR DO CONTRATO E FORMAS DE PAGAMENTO</p>
            <p>4.1 O CONTRATANTE obriga-se a pagar ao CONTRATADO a importância de (R$ ${valorReaisStr}) (${valorExtensoStr}) pela prestação dos serviços descritos na Cláusula I deste contrato.</p>
            <p>4.2 O valor total poderá ser pago à vista, por meio de transferência bancária (“PIX”) ou com uma entrada de até 30% do valor do contrato, e o restante sendo pago até a semana do evento tendo como data limite o dia que antecede o mesmo.</p>
            <p>4.3 O número de telefone do CONTRATADO deverá ser usado como código “PIX” para a realização do pagamento e corresponde ao seguinte número: (24)99987-3558</p>

            <p style="font-weight: bold;">CLÁUSULA V – DOS SERVIÇOS EXTRAS</p>
            <p>5.1 Se durante a realização do evento o CONTRATANTE solicitar a continuidade da prestação do serviço por um período maior do que o previsto no presente contrato, uma taxa de R$200,00 (duzentos reais) será cobrada a cada hora extra adicional.</p>

            <p style="font-weight: bold;">CLÁUSULA VI – DO CANCELAMENTO DO CONTRATO</p>
            <p>6.1 Qualquer das partes poderá cancelar livremente o presente contrato sem a imputação de multas até 30 dias antes da data da realização do evento desde que a outra parte seja formalmente comunicada.</p>
            <p>6.2 Em caso de cancelamento do contrato, antes da data do evento, por parte do CONTRATANTE, fica estabelecida a multa contratual em favor do CONTRATADO no valor de R$ 250,00 (duzentos e cinquenta reais).</p>
            <p>6.3 Caso o cancelamento ocorra fora do prazo previsto no item 6.1, o CONTRATANTE poderá solicitar reembolso dos valores pagos ao CONTRATADO descontado o valor da multa prevista no item 6.2.</p>
            <p>6.4 Em caso de cancelamento do contrato, antes da data do evento, por parte do CONTRATADO, todo o valor eventualmente pago deverá ser devolvido integramente ao CONTRATANTE em até 5 dias uteis após a comunicação formal do cancelamento.</p>
            <p>Parágrafo único: Caso o CONTRATANTE não cumpra qualquer das cláusulas acima descritas, o CONTRATADO poderá rescindir o presente contrato sem qualquer ônus.</p>

            <p style="font-weight: bold;">CLÁUSULA 7ª – DANOS AO EQUIPAMENTO</p>
            <p>7.1 – Caso algum dano seja causado ao equipamento, por parte do público presente durante a realização do evento, o CONTRATANTE deverá arcar com todas as despesas para o reparo e manutenção do mesmo.</p>

            <p style="font-weight: bold;">CLÁUSULA 8ª – DISPOSIÇÕES GERAIS</p>
            <p>8.1 - As imagens brutas, originais gerados pela prestação de serviços regulamentada por este contrato são de propriedade do CONTRATADO, cabendo ao mesmo os créditos e direitos autorais, conforme a lei 9.610 de 20 de fevereiro de 1998.</p>

            <p style="font-weight: bold;">CLÁUSULA 9ª – AUTORIZAÇÃO DO USO DE IMAGEM</p>
            <p>9.1 - O CONTRATANTE autoriza o CONTRATADO a utilizar as imagens geradas durante a captação em seu portfólio, seja ele online, peças publicitárias que promovam o seu trabalho e mostruários, sem necessidade de nova autorização específica do CONTRATANTE.</p>

            <p style="font-weight: bold;">CLÁUSULA 10ª – DA PROTEÇÃO E DO PRAZO PARA O USO DOS DADOS PESSOAIS DO CONTRATANTE</p>
            <p>10.1 - Com o advento da Lei Geral de Proteção de Dados, nº 13.709/18, esclarece-se que os dados pessoais coletados do CONTRANTE, bem como suas imagens, permanecerão na base de arquivos do CONTRATADO, a qual somente este possui acesso, pelo prazo de até 2 anos, contados da assinatura no presente contrato.</p>
            <p>Parágrafo único – Neste ato, consente o CONTRATANTE o uso de suas imagens nas redes sociais do CONTRATADO, com a finalidade de divulgação de seus trabalhos nas mídias sociais, quais sejam, Instagram, TikTok, Facebook, WhatsApp, pelo prazo previsto no caput deste artigo, salvo se a parte CONTRATANTE manifestar expressamente pela eliminação de suas imagens dos registros da CONTRATADA, o que deverá ser atendido imediatamente.</p>

            <p style="font-weight: bold;">CLÁUSULA 11ª – DO PERÍODO DE PANDEMIA</p>
            <p>11.1 - Fica estabelecido entre as partes que em tempos de pandemia/COVID-19 e ou estado de calamidade pública, as alterações poderão ocorrer mediante aviso prévio e alterações de datas e locais com novo termo aditivo firmando a veracidade dos fatos, tendo em vista o distanciamento e a preservação da saúde e do bem-estar. Neste sentido, o CONTRATANTE terá o prazo de até 1 (um) ano para remarcar seu evento, sem aplicação de multa.</p>

            <p style="font-weight: bold;">CLÁUSULA 12ª – DA ALTERAÇÃO ABRUPTA DO DIA DA CAPTAÇÃO MARCADA</p>
            <p>12.1 - Sem prejuízo das demais disposições contratuais previstas no presente termo, se esclarece que, a execução do serviço está condicionada a estabilidade do tempo/clima da região em que a captação será realizada, pelo que, havendo chuvas, falta de energia elétrica ou quaisquer outros atos como causados por força maior ou caso fortuito, que não estejam previsíveis de maneira óbvia aos contratantes, ensejará, nesses casos, o adiamento ou cancelamento, pela parte CONTRATADA, desde que seja comunicada a outra parte no limite mínimo de 24 (vinte e quatro horas). Medida esta que visa à segurança não apenas da equipe, mas dos demais envolvidos, não cabendo nesse caso qualquer tipo de indenização de ambas as partes.</p>
            <p>Parágrafo único: A alteração mencionada no caput desta cláusula estará sujeita a nova marcação pelo CONTRATADO, cabendo às partes pactuarem antecipadamente o dia e local, desde que não colida com outros eventos já predefinidos com o CONTRATADO.</p>

            <p style="font-weight: bold;">CLÁUSULA 13ª – FORO</p>
            <p>13.1 - As partes contratantes elegem o foro da cidade de Volta Redonda/Rio de Janeiro, exclusivamente, para resolver quaisquer questões referentes ao presente contrato.</p>
            <p>13.2 - E, por estarem assim justos e contratados assinam o presente contrato em duas vias de igual teor e forma, para um só efeito, abaixo assinado.</p>
            
            <p>Volta Redonda, ${dataAssinatura}.</p>
            
            <br><br><br>
            <div style="text-align: center;">
                <p style="margin: 0;">_____________________________________________</p>
                <p style="font-weight: bold; margin: 0;">CONTRATADO</p>
                <p style="margin: 0;">(Maby eventos)</p>
            </div>
            <br><br><br>
            <div style="text-align: center;">
                <p style="margin: 0;">_____________________________________________</p>
                <p style="font-weight: bold; margin: 0;">CONTRATANTE</p>
                <p style="margin: 0;">(${festa.cliente})</p>
            </div>
        </div>
    `;

    const preHtml = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Contrato Maby Eventos</title></head><body>";
    const postHtml = "</body></html>";
    const htmlExport = preHtml + conteudoWordHtml + postHtml;

    const converted = htmlDocx.asBlob(htmlExport);
    const filename = `Contrato_Maby_${festa.cliente.replace(/\s+/g, '_')}.docx`;
    saveAs(converted, filename);

    showToast("Contrato baixado com sucesso!", "success");
}

// ========================================================
// GERADOR DE RELATÓRIO MENSAL NO WORD (.docx)
// ========================================================
window.gerarRelatorioWord = function() {
    showToast("Gerando relatório mensal...", "info");

    const dataAtual = new Date();
    const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const anoAtual = dataAtual.getFullYear();
    const prefixoMes = `${anoAtual}-${mesAtual}`;

    const festasDoMes = festasGlobais.filter(f => {
        let dataRef = f.criadoEm || f.data;
        return dataRef && dataRef.startsWith(prefixoMes);
    });

    let agendadas = 0;
    let concluidas = 0;
    let horasTrabalhadas = 0;
    let valorTotalRecebidoMes = 0;
    let usoEquipamentos = {};
    let rendaEquipamentos = {};

    festasDoMes.forEach(f => {
        if (f.status === 'agendada') agendadas++;
        if (f.status === 'concluida') {
            concluidas++;
            horasTrabalhadas += parseFloat(f.horas) || 0;
        }
        
        valorTotalRecebidoMes += parseFloat(f.valorPago) || 0;

        let detalhes = f.detalhesEquipamentos || {};

        if (f.equipamento) {
            const equips = f.equipamento.split(',').map(e => e.trim()).filter(e => e !== "");
            equips.forEach(eq => {
                usoEquipamentos[eq] = (usoEquipamentos[eq] || 0) + 1;
                
                let eqValorCobrado = 0;
                if(detalhes[eq]) {
                    let val = parseFloat(detalhes[eq].valor) || 0;
                    let descVal = parseFloat(detalhes[eq].desconto) || 0;
                    let descType = detalhes[eq].tipoDesconto || 'R$';
                    
                    let finalEqVal = val;
                    if (descType === '%') {
                        finalEqVal -= val * (descVal / 100);
                    } else {
                        finalEqVal -= descVal;
                    }
                    eqValorCobrado = finalEqVal > 0 ? finalEqVal : 0;
                }
                
                rendaEquipamentos[eq] = (rendaEquipamentos[eq] || 0) + eqValorCobrado;
            });
        }
    });

    let equipamentoMaisUsado = "Nenhum";
    let maxUso = 0;
    for (let eq in usoEquipamentos) {
        if (usoEquipamentos[eq] > maxUso) {
            maxUso = usoEquipamentos[eq];
            equipamentoMaisUsado = eq;
        }
    }

    let htmlRendaEquips = "";
    for (let eq in usoEquipamentos) {
        let qtd = usoEquipamentos[eq];
        let renda = rendaEquipamentos[eq] || 0;
        htmlRendaEquips += `<li><strong>${eq}:</strong> Contratado ${qtd} vez(es) - Total cobrado: R$ ${renda.toFixed(2).replace('.', ',')}</li>`;
    }

    const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMes = mesesExtenso[dataAtual.getMonth()];

    const conteudoHTML = `
        <div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #333;">
            <h1 style="text-align: center; color: #007bff;">Relatório de Desempenho - Maby Eventos</h1>
            <h3 style="text-align: center; color: #555;">Mês de Referência: ${nomeMes} de ${anoAtual}</h3>
            <p style="text-align: center; font-size: 10pt; color: #666;">*Dados baseados na data em que o evento foi agendado no sistema.</p>
            <hr style="border: 1px solid #ccc; margin: 20px 0;">
            
            <h2>Resumo Geral do Mês</h2>
            <ul>
                <li><strong>Festas Agendadas (A Realizar):</strong> ${agendadas}</li>
                <li><strong>Festas Concluídas:</strong> ${concluidas}</li>
                <li><strong>Total de Horas Trabalhadas (Festas Concluídas):</strong> ${horasTrabalhadas} horas</li>
                <li><strong>Total Bruto Recebido no Mês:</strong> R$ ${valorTotalRecebidoMes.toFixed(2).replace('.', ',')}</li>
            </ul>
            
            <br>
            <h2>Análise de Equipamentos</h2>
            <p><strong>Equipamento Mais Requisitado:</strong> ${equipamentoMaisUsado} (${maxUso} locações neste mês)</p>
            
            <h3>Renda e Quantidade por Equipamento:</h3>
            <p style="font-size: 10pt; color: #666;">(Valor total cobrado por cada equipamento nas festas contratadas)</p>
            <ul>
                ${htmlRendaEquips || '<li>Nenhum equipamento registrado neste mês.</li>'}
            </ul>
            
            <br><br><br>
            <p style="text-align: center; font-size: 10pt; color: #999;">Relatório gerado automaticamente pelo sistema MabyEventos em ${dataAtual.toLocaleDateString('pt-BR')} às ${dataAtual.toLocaleTimeString('pt-BR')}</p>
        </div>
    `;

    const preHtml = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Relatório Mensal Maby Eventos</title></head><body>";
    const postHtml = "</body></html>";
    const htmlExport = preHtml + conteudoHTML + postHtml;

    const converted = htmlDocx.asBlob(htmlExport);
    saveAs(converted, `Relatorio_MabyEventos_${nomeMes}_${anoAtual}.docx`);
    showToast("Relatório gerado com sucesso!", "success");
}

const btnGerarRelatorio = document.getElementById('btn-gerar-relatorio');
if(btnGerarRelatorio) {
    btnGerarRelatorio.addEventListener('click', window.gerarRelatorioWord);
}

// ========================================================
// MÁSCARAS DE INPUTS E CEPS
// ========================================================
function aplicarMascaraCPF(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
}
const inputCpf = document.getElementById('client-cpf');
if(inputCpf) inputCpf.addEventListener('input', function() { aplicarMascaraCPF(this); });

const editInputCpf = document.getElementById('edit-client-cpf');
if(editInputCpf) editInputCpf.addEventListener('input', function() { aplicarMascaraCPF(this); });

function setupCep(cepId, ruaId, bairroId, cidadeId, estadoId) {
    const cepInput = document.getElementById(cepId);
    if(cepInput) {
        cepInput.addEventListener('blur', async (e) => {
            let cep = e.target.value.replace(/\D/g, '');
            if(cep.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if(!data.erro) {
                        document.getElementById(ruaId).value = data.logradouro;
                        document.getElementById(bairroId).value = data.bairro;
                        document.getElementById(cidadeId).value = data.localidade;
                        document.getElementById(estadoId).value = data.uf;
                    }
                } catch(err) { console.log('Erro ao buscar CEP'); }
            }
        });
    }
}
setupCep('client-cep', 'client-rua', 'client-bairro', 'client-cidade', 'client-estado');
setupCep('edit-client-cep', 'edit-client-rua', 'edit-client-bairro', 'edit-client-cidade', 'edit-client-estado');

// ========================================================
// SISTEMA DE LOGIN REAL E NAVEGAÇÃO
// ========================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if(loginContainer) loginContainer.classList.add('hidden');
        if(appContainer) appContainer.classList.remove('hidden');
        await carregarEquipamentos(); 
        await carregarDadosGlobais();
    } else {
        if(appContainer) appContainer.classList.add('hidden');
        if(loginContainer) loginContainer.classList.remove('hidden');
    }
});

if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;
        const btnLogin = document.getElementById('btn-login');
        
        btnLogin.textContent = "Verificando...";
        btnLogin.disabled = true;

        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch (error) { showToast("Acesso Negado: Verifique seu e-mail ou senha.", "error"); } 
        finally { btnLogin.textContent = "Entrar"; btnLogin.disabled = false; }
    });
}

if(logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
}

// ========================================================
// UI: TEMA E NAVEGAÇÃO
// ========================================================
if(themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isDark = body.getAttribute('data-theme') === 'dark';
        body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggleBtn.innerHTML = isDark ? '<i class="ph ph-moon"></i>' : '<i class="ph ph-sun"></i>';
    });
}

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

window.calcTime = function(prefix) {
    const startInput = document.getElementById(`${prefix}-start-time`);
    const hoursInput = document.getElementById(`${prefix}-hours`);
    const endInput = document.getElementById(`${prefix}-end-time`);
    
    const cbPausa = document.getElementById(`${prefix}-has-pause`);
    const temPausa = cbPausa ? cbPausa.checked : false;
    const horasPausa = temPausa ? (parseFloat(document.getElementById(`${prefix}-pause-hours`)?.value) || 0) : 0;

    if (startInput && hoursInput && startInput.value && hoursInput.value) {
        const [hours, minutes] = startInput.value.split(':').map(Number);
        
        const durationTrabalho = parseFloat(hoursInput.value) || 0;
        const durationTotal = durationTrabalho + horasPausa;
        
        const durationHours = Math.floor(durationTotal);
        const durationMinutes = Math.round((durationTotal - durationHours) * 60);

        let endHours = hours + durationHours;
        let endMinutes = minutes + durationMinutes;

        if (endMinutes >= 60) {
            endHours += Math.floor(endMinutes / 60);
            endMinutes = endMinutes % 60;
        }
        endHours = endHours % 24; 
        if(endInput) endInput.value = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    } else if (endInput) { 
        endInput.value = ''; 
    }
}

// ========================================================
// CÁLCULO DE VALOR DE FESTA COM DESCONTO E PAUSA
// ========================================================
window.togglePauseDetails = function(prefix) {
    const checkbox = document.getElementById(`${prefix}-has-pause`);
    const detailsDiv = document.getElementById(`${prefix}-pause-details`);
    if(checkbox && checkbox.checked) {
        if(detailsDiv) detailsDiv.classList.remove('hidden');
    } else {
        if(detailsDiv) detailsDiv.classList.add('hidden');
        const inputHours = document.getElementById(`${prefix}-pause-hours`);
        const inputCost = document.getElementById(`${prefix}-pause-cost`);
        if(inputHours) inputHours.value = '0';
        if(inputCost) inputCost.value = '0';
    }
    window.calcTime(prefix);
    window.calcTotalNovo(prefix);
}

window.toggleEqDetails = function(checkbox) {
    const wrapper = checkbox.closest('.checkbox-item-wrapper');
    const details = wrapper.querySelector('.eq-details');
    if (checkbox.checked) {
        details.classList.remove('hidden');
    } else {
        details.classList.add('hidden');
    }
    
    const isEdit = wrapper.closest('#edit-party-eq-container') !== null;
    const prefix = isEdit ? 'edit-party' : 'party';
    window.calcTotalNovo(prefix);
}

window.calcTotalNovo = function(prefix) {
    let total = 0;
    const containerId = prefix === 'edit-party' ? 'edit-party-eq-container' : 'party-eq-container';
    const wrappers = document.querySelectorAll(`#${containerId} .checkbox-item-wrapper`);
    
    wrappers.forEach(w => {
        const cb = w.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
            const val = parseFloat(w.querySelector('.eq-valor').value) || 0;
            const descVal = parseFloat(w.querySelector('.eq-desc').value) || 0;
            const descType = w.querySelector('.eq-desc-type').value; 
            
            let finalEqVal = val;
            if (descType === '%') {
                finalEqVal -= val * (descVal / 100);
            } else {
                finalEqVal -= descVal;
            }
            
            total += finalEqVal;
        }
    });

    const cbPausa = document.getElementById(`${prefix}-has-pause`);
    if (cbPausa && cbPausa.checked) {
        const custoPausa = parseFloat(document.getElementById(`${prefix}-pause-cost`)?.value) || 0;
        total += custoPausa;
    }

    const globalDescVal = parseFloat(document.getElementById(`${prefix}-desconto-global`).value) || 0;
    const globalDescType = document.getElementById(`${prefix}-desc-type`).value; 
    
    if (globalDescType === '%') {
        total -= total * (globalDescVal / 100);
    } else {
        total -= globalDescVal;
    }
    
    if (total < 0) total = 0;

    const vInput = document.getElementById(`${prefix}-value`);
    if(vInput) vInput.value = total.toFixed(2);
}

// ========================================================
// EQUIPAMENTOS E CHECKBOXES
// ========================================================
async function carregarEquipamentos() {
    try {
        equipamentosGlobais = await getEquipamentos();
        const listaContainer = document.getElementById('equipments-list-container');
        if(listaContainer) listaContainer.innerHTML = '';
        
        const containerAdd = document.getElementById('party-eq-container');
        const containerEdit = document.getElementById('edit-party-eq-container');
        let htmlCheckboxes = '';

        if (equipamentosGlobais.length === 0) {
            if(listaContainer) listaContainer.innerHTML = '<p style="color: var(--text-muted);">Nenhum equipamento cadastrado ainda.</p>';
            htmlCheckboxes = '<p style="color: var(--text-muted); font-size: 14px;">Nenhum equipamento cadastrado.</p>';
        } else {
            equipamentosGlobais.forEach(eq => {
                if(listaContainer) {
                    const item = document.createElement('div');
                    item.className = 'equip-item';
                    item.innerHTML = `
                        <div class="equip-info">
                            <strong><i class="ph ph-speaker-hifi"></i> ${eq.nome}</strong>
                            <span>R$ ${Number(eq.valorSugerido).toFixed(2).replace('.', ',')} (Sugerido)</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="window.abrirModalEdicaoEquipamento('${eq.id}')" class="btn-delete-icon" style="color: var(--accent-color);" title="Editar">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button onclick="window.excluirEquipamento('${eq.id}')" class="btn-delete-icon" title="Excluir">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    `;
                    listaContainer.appendChild(item);
                }

                htmlCheckboxes += `
                    <div class="checkbox-item-wrapper" data-nome="${eq.nome}">
                        <label class="checkbox-item">
                            <input type="checkbox" name="equipamento" value="${eq.nome}" class="eq-cb" onchange="window.toggleEqDetails(this)">
                            ${eq.nome} (Sugerido: R$ ${Number(eq.valorSugerido).toFixed(2)})
                        </label>
                        <div class="eq-details hidden">
                            <div style="flex: 1;">
                                <label>Valor Cobrado (R$)</label>
                                <input type="number" step="0.01" class="eq-valor" value="${eq.valorSugerido}" oninput="window.calcTotalNovo(this.closest('#edit-party-eq-container') ? 'edit-party' : 'party')">
                            </div>
                            <div style="flex: 1.5; display: flex; flex-direction: column;">
                                <label>Desconto Equipamento</label>
                                <div style="display: flex; gap: 5px;">
                                    <select class="eq-desc-type" onchange="window.calcTotalNovo(this.closest('#edit-party-eq-container') ? 'edit-party' : 'party')" style="width: 70px;">
                                        <option value="R$">R$</option>
                                        <option value="%">%</option>
                                    </select>
                                    <input type="number" step="0.01" class="eq-desc" value="0" oninput="window.calcTotalNovo(this.closest('#edit-party-eq-container') ? 'edit-party' : 'party')" style="flex: 1;">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        if(containerAdd) containerAdd.innerHTML = htmlCheckboxes;
        if(containerEdit) containerEdit.innerHTML = htmlCheckboxes;

    } catch (error) { showToast("Erro ao carregar equipamentos.", "error"); }
}

window.excluirEquipamento = function(id) {
    customConfirm("Deseja realmente excluir este equipamento?", async () => {
        try { 
            await deleteEquipamento(id);
            await carregarEquipamentos();
            showToast("Equipamento excluído.", "success");
        } 
        catch(e) { showToast("Erro ao excluir equipamento.", "error"); }
    });
}

window.abrirModalEdicaoEquipamento = function(id) {
    const eq = equipamentosGlobais.find(e => e.id === id);
    if(!eq || !editEqModal) return;

    document.getElementById('edit-eq-id').value = eq.id;
    document.getElementById('edit-eq-name-input').value = eq.nome || '';
    document.getElementById('edit-eq-value-input').value = eq.valorSugerido || '';

    editEqModal.classList.remove('hidden');
}

const formEditEq = document.getElementById('form-edit-equipment');
if(formEditEq) {
    formEditEq.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEq = document.getElementById('edit-eq-id').value;
        const nomeEq = document.getElementById('edit-eq-name-input').value;
        const valorEq = parseFloat(document.getElementById('edit-eq-value-input').value);

        const btnSubmit = formEditEq.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Atualizando...";
        btnSubmit.disabled = true;

        try {
            const eqDoc = doc(db, "equipamentos", idEq);
            await updateDoc(eqDoc, { nome: nomeEq, valorSugerido: valorEq });
            
            if(editEqModal) editEqModal.classList.add('hidden');
            await carregarEquipamentos();
            showToast("Equipamento atualizado!", "success");
        } catch (error) {
            showToast("Erro ao atualizar equipamento.", "error");
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });
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
            showToast("Equipamento cadastrado com sucesso!", "success");
        } catch (error) { showToast("Erro ao salvar equipamento.", "error"); } 
        finally { btnSubmit.disabled = false; btnSubmit.innerHTML = `<i class="ph ph-floppy-disk"></i> Cadastrar Equipamento`; }
    });
}

// ========================================================
// FESTAS E FINANCEIRO
// ========================================================
async function carregarDadosGlobais() {
    try {
        festasGlobais = await getFestas();

        let qtdAgendadas = 0, qtdRealizadas = 0, valorReceber = 0, valorRecebido = 0;
        
        festasGlobais.forEach(festa => {
            const total = Number(festa.valor) || 0;
            const pago = Number(festa.valorPago) || 0; 
            
            valorRecebido += pago;
            let restante = total - pago;
            if (restante < 0) restante = 0;
            valorReceber += restante;

            if (festa.status === 'agendada') qtdAgendadas++;
            else if (festa.status === 'concluida') qtdRealizadas++;
        });

        const cAgendadas = document.getElementById('count-agendadas');
        const cRealizadas = document.getElementById('count-realizadas');
        const cPendente = document.getElementById('val-pendente');
        const cRecebido = document.getElementById('val-recebido');

        if(cAgendadas) cAgendadas.textContent = qtdAgendadas;
        if(cRealizadas) cRealizadas.textContent = qtdRealizadas;
        if(cPendente) cPendente.textContent = `R$ ${valorReceber.toFixed(2).replace('.', ',')}`;
        if(cRecebido) cRecebido.textContent = `R$ ${valorRecebido.toFixed(2).replace('.', ',')}`;

        popularFiltroMeses(festasGlobais);
        aplicarFiltrosNaLista();
        renderCalendar();
    } catch (error) { showToast("Erro ao carregar dados do banco.", "error"); }
}

function popularFiltroMeses(festas) {
    if(!filterMonth) return;
    const mesesExistentes = new Set();
    festas.forEach(f => { if(f.data) mesesExistentes.add(f.data.substring(0, 7)); });
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
    if(!filterStatus || !filterMonth) return;
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

if(filterStatus) filterStatus.addEventListener('change', aplicarFiltrosNaLista);
if(filterMonth) filterMonth.addEventListener('change', aplicarFiltrosNaLista);

function renderPartyList(festas) {
    const listaContainer = document.getElementById('party-list-container');
    if(!listaContainer) return;
    listaContainer.innerHTML = '';
    if(festas.length === 0) {
        listaContainer.innerHTML = '<p style="color: var(--text-muted);">Nenhuma festa encontrada.</p>';
        return;
    }

    festas.forEach(festa => {
        const [ano, mes, dia] = festa.data.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        
        const classeStatus = festa.status === 'concluida' ? 'status-completed' : 'status-scheduled';
        const badgeClass = festa.status === 'concluida' ? 'green' : 'blue';
        const textoStatus = festa.status === 'concluida' ? 'Evento Concluído' : 'Evento Agendado';
        
        const total = Number(festa.valor) || 0;
        const pago = Number(festa.valorPago) || 0;
        const restante = total - pago;
        const statusPagamento = restante <= 0 ? 'Já Paga' : 'Pgto Pendente';
        const badgePagamentoClass = restante <= 0 ? 'green' : 'yellow';

        const card = document.createElement('div');
        card.className = `party-card ${classeStatus}`;
        card.innerHTML = `
            <div class="party-header">
                <h4><i class="ph ph-confetti"></i> ${festa.nome || 'Evento sem nome'}</h4>
                <div class="badge-group">
                    <span class="badge ${badgePagamentoClass}"><i class="ph ph-currency-dollar"></i> ${statusPagamento}</span>
                    <span class="badge ${badgeClass}">${textoStatus}</span>
                </div>
            </div>
            <div class="party-body">
                <div class="party-info-item">
                    <i class="ph ph-calendar-blank"></i>
                    <span><strong>${dataFormatada}</strong> (${festa.horaInicio || '--:--'} às ${festa.horaFim || '--:--'})</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-speaker-hifi"></i>
                    <span><strong>Equipamentos:</strong> ${festa.equipamento || 'N/A'}</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-user"></i>
                    <span><strong>Cliente:</strong> ${festa.cliente || 'N/A'}</span>
                </div>
                <div class="party-info-item">
                    <i class="ph ph-wallet"></i>
                    <span class="party-value-highlight">Restam: R$ ${(restante > 0 ? restante : 0).toFixed(2).replace('.', ',')}</span>
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
            if (festasDoDia.length > 1) { day.classList.add('bg-yellow'); } 
            else {
                if (festasDoDia[0].status === 'concluida') { day.classList.add('bg-green'); } 
                else { day.classList.add('bg-blue'); }
            }
        }
        
        day.addEventListener('click', () => abrirModalDetalhes(festasDoDia, dataBusca)); 
        calendarDays.appendChild(day);
    }
}

const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
if(btnPrevMonth) btnPrevMonth.addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() - 1); renderCalendar(); });
if(btnNextMonth) btnNextMonth.addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + 1); renderCalendar(); });

window.agendarFestaPeloCalendario = function(dataBusca) {
    if(partyModal) partyModal.classList.add('hidden');
    const menuBtn = document.querySelector('.menu-btn[data-view="view-schedule"]');
    if(menuBtn) menuBtn.click();
    const pDate = document.getElementById('party-date');
    if(pDate) pDate.value = dataBusca;
}

function abrirModalDetalhes(festasDoDia, dataBusca) {
    const container = document.getElementById('modal-dynamic-content');
    if(!container || !partyModal) return;
    
    container.innerHTML = ''; 
    
    const [ano, mes, dia] = dataBusca.split('-');
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.textContent = `Eventos do dia ${dia}/${mes}/${ano}`;

    if (festasDoDia.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px 10px;">
                <i class="ph ph-calendar-blank" style="font-size: 48px; color: var(--text-muted); margin-bottom: 15px; display: block;"></i>
                <p style="color: var(--text-muted); margin-bottom: 25px; font-size: 16px;">Nenhum evento agendado para este dia.</p>
                <button onclick="window.agendarFestaPeloCalendario('${dataBusca}')" class="btn-primary" style="max-width: 250px; margin: 0 auto;">
                    <i class="ph ph-plus-circle"></i> Agendar Nova Festa
                </button>
            </div>
        `;
    } else {
        festasDoDia.forEach((festa, index) => {
            const bloco = document.createElement('div');
            bloco.className = 'modal-party-block';
            
            const numFesta = festasDoDia.length > 1 ? ` (Evento ${index + 1})` : '';
            let numeroWhats = (festa.whatsapp || '').replace(/\D/g, '');
            const enderecoMapeado = encodeURIComponent(festa.endereco || '');

            const total = Number(festa.valor) || 0;
            const pago = Number(festa.valorPago) || 0;
            const restante = total - pago;

            let htmlFinanceiro = `
                <div class="finance-box">
                    <div class="finance-box-grid">
                        <div class="finance-item"><span>Total Final</span><strong>R$ ${total.toFixed(2)}</strong></div>
                        <div class="finance-item pago"><span>Já Pago</span><strong>R$ ${pago.toFixed(2)}</strong></div>
                        <div class="finance-item restante"><span>Falta Pagar</span><strong>R$ ${(restante > 0 ? restante : 0).toFixed(2)}</strong></div>
                    </div>
                    ${restante > 0 ? `
                        <div class="add-payment-controls">
                            <input type="number" step="0.01" id="add-pay-${festa.id}" placeholder="R$ Receber agora">
                            <button onclick="window.adicionarPagamento('${festa.id}', ${pago})">Salvar Pagamento</button>
                        </div>
                    ` : `<div style="text-align:center; color: var(--status-done); font-weight:bold;"><i class="ph ph-check-circle"></i> Festa totalmente paga!</div>`}
                </div>
            `;

            const btnConcluirHtml = festa.status === 'agendada' 
                ? `<button onclick="window.marcarConcluida('${festa.id}')" class="btn-action finish"><i class="ph ph-check-circle"></i> Marcar Trabalho Realizado</button>`
                : `<span style="display:flex; align-items:center; gap:5px; color:var(--status-done); font-weight:bold; padding: 10px;"><i class="ph ph-check-circle"></i> Trabalho Realizado</span>`;

            let textoHoras = `${festa.horas}h de serviço`;
            if(festa.temPausa && festa.horasPausa > 0) {
                textoHoras += ` + ${festa.horasPausa}h de pausa`;
            }

            bloco.innerHTML = `
                <h3><span><i class="ph ph-confetti"></i> ${festa.nome || 'Evento sem nome'} ${numFesta}</span></h3>
                <p><i class="ph ph-clock"></i> <strong>Horário:</strong> ${festa.horaInicio || '--:--'} às ${festa.horaFim || '--:--'} <span style="font-size:12px; color:var(--text-muted);">(${textoHoras})</span></p>
                <p><i class="ph ph-speaker-hifi"></i> <strong>Equipamentos:</strong> ${festa.equipamento || 'N/A'}</p>
                <p><i class="ph ph-map-pin"></i> <strong>Local do Evento:</strong> ${festa.endereco || 'N/A'}</p>
                
                ${festa.observacoes ? `<div style="background-color: var(--bg-color); padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 14px; border-left: 3px solid var(--accent-color);"><i class="ph ph-text-align-left" style="color:var(--accent-color);"></i> <strong>Obs:</strong> ${festa.observacoes}</div>` : ''}
                
                <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 15px 0;">
                
                <p><i class="ph ph-user"></i> <strong>Contratante:</strong> ${festa.cliente || 'N/A'} (CPF: ${festa.cpf || 'Não info.'})</p>
                <p><i class="ph ph-map-pin"></i> <strong>Endereço Cliente:</strong> ${festa.rua || 'N/A'}, ${festa.numero || 'S/N'} - ${festa.bairro || ''}</p>
                <p><i class="ph ph-users"></i> <strong>Equipe:</strong> ${festa.equipe || 'Não informada'}</p>

                ${htmlFinanceiro}
                
                <div class="modal-actions">
                    <a href="https://waze.com/ul?q=${enderecoMapeado}" target="_blank" class="btn-action waze"><i class="ph ph-navigation-arrow"></i> Waze</a>
                    <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapeado}" target="_blank" class="btn-action maps"><i class="ph ph-map-pin"></i> Maps</a>
                    <a href="https://wa.me/55${numeroWhats}" target="_blank" class="btn-action whats"><i class="ph ph-whatsapp-logo"></i> Cliente</a>
                    <button onclick="window.gerarContratoWord('${festa.id}')" class="btn-action word"><i class="ph ph-file-doc"></i> Baixar Contrato</button>
                </div>
                
                <div class="modal-actions" style="border-top: none; padding-top: 0;">
                    <button onclick="window.abrirModalEdicao('${festa.id}')" class="btn-action edit"><i class="ph ph-pencil-simple"></i> Editar</button>
                    ${btnConcluirHtml}
                    <button onclick="window.excluirFesta('${festa.id}')" class="btn-action delete"><i class="ph ph-trash"></i> Excluir</button>
                </div>
            `;
            container.appendChild(bloco);
        });

        const btnNovaFestaDiv = document.createElement('div');
        btnNovaFestaDiv.style.marginTop = '20px';
        btnNovaFestaDiv.innerHTML = `
            <button onclick="window.agendarFestaPeloCalendario('${dataBusca}')" class="btn-primary" style="background-color: transparent; color: var(--text-main); border: 2px dashed var(--border-color); box-shadow:none;">
                <i class="ph ph-plus-circle"></i> Agendar Outra Festa Neste Dia
            </button>
        `;
        container.appendChild(btnNovaFestaDiv);
    }

    partyModal.classList.remove('hidden');
}

if(closeModalBtn) closeModalBtn.addEventListener('click', () => { partyModal.classList.add('hidden'); });
if(closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => { editModal.classList.add('hidden'); });
if(closeEditEqModalBtn) closeEditEqModalBtn.addEventListener('click', () => { editEqModal.classList.add('hidden'); });

window.addEventListener('click', (e) => { 
    if (partyModal && e.target === partyModal) partyModal.classList.add('hidden');
    if (editModal && e.target === editModal) editModal.classList.add('hidden');
    if (editEqModal && e.target === editEqModal) editEqModal.classList.add('hidden');
});

window.adicionarPagamento = function(id, valorPagoAtual) {
    const inputField = document.getElementById(`add-pay-${id}`);
    const valorAdicional = parseFloat(inputField.value);
    
    if (isNaN(valorAdicional) || valorAdicional <= 0) { showToast("Digite um valor numérico maior que zero.", "error"); return; }
    
    customConfirm(`Confirmar recebimento de R$ ${valorAdicional.toFixed(2)} para esta festa?`, async () => {
        const novoValorPago = valorPagoAtual + valorAdicional;
        try {
            await updateFesta(id, { valorPago: novoValorPago });
            partyModal.classList.add('hidden');
            await carregarDadosGlobais();
            showToast("Pagamento registrado com sucesso!", "success");
        } catch (e) { showToast("Erro ao registrar pagamento.", "error"); }
    });
}

window.marcarConcluida = function(id) {
    customConfirm("Deseja marcar o TRABALHO desta festa como realizado?", async () => {
        try {
            await updateFesta(id, { status: 'concluida' });
            partyModal.classList.add('hidden');
            await carregarDadosGlobais();
            showToast("Festa marcada como concluída!", "success");
        } catch (error) { showToast("Erro ao atualizar status.", "error"); }
    });
}

window.excluirFesta = function(id) {
    customConfirm("ATENÇÃO: Deseja excluir este agendamento? Esta ação não pode ser desfeita.", async () => {
        try {
            await deleteFesta(id);
            partyModal.classList.add('hidden');
            await carregarDadosGlobais();
            showToast("Agendamento excluído com sucesso.", "success");
        } catch (error) { showToast("Erro ao excluir festa.", "error"); }
    });
}

window.abrirModalEdicao = function(id) {
    const festa = festasGlobais.find(f => f.id === id);
    if(!festa || !partyModal || !editModal) return;

    partyModal.classList.add('hidden');
    editModal.classList.remove('hidden');

    document.getElementById('edit-party-id').value = festa.id;
    document.getElementById('edit-party-name').value = festa.nome || '';
    document.getElementById('edit-party-address').value = festa.endereco || '';
    document.getElementById('edit-party-date').value = festa.data || '';
    document.getElementById('edit-party-start-time').value = festa.horaInicio || '';
    document.getElementById('edit-party-hours').value = festa.horas || '';
    document.getElementById('edit-party-end-time').value = festa.horaFim || '';
    
    const cbPausa = document.getElementById('edit-party-has-pause');
    const inputPausaHoras = document.getElementById('edit-party-pause-hours');
    const inputPausaCusto = document.getElementById('edit-party-pause-cost');
    const divPausaDetails = document.getElementById('edit-party-pause-details');
    
    if(festa.temPausa) {
        if(cbPausa) cbPausa.checked = true;
        if(inputPausaHoras) inputPausaHoras.value = festa.horasPausa || 0;
        if(inputPausaCusto) inputPausaCusto.value = festa.valorPausa || 0;
        if(divPausaDetails) divPausaDetails.classList.remove('hidden');
    } else {
        if(cbPausa) cbPausa.checked = false;
        if(inputPausaHoras) inputPausaHoras.value = 0;
        if(inputPausaCusto) inputPausaCusto.value = 0;
        if(divPausaDetails) divPausaDetails.classList.add('hidden');
    }

    const obsInput = document.getElementById('edit-party-obs');
    if(obsInput) obsInput.value = festa.observacoes || '';
    
    document.getElementById('edit-client-name').value = festa.cliente || '';
    document.getElementById('edit-client-cpf').value = festa.cpf || '';
    document.getElementById('edit-client-whatsapp').value = festa.whatsapp || '';
    document.getElementById('edit-client-cep').value = festa.cep || '';
    document.getElementById('edit-client-rua').value = festa.rua || '';
    document.getElementById('edit-client-numero').value = festa.numero || '';
    document.getElementById('edit-client-bairro').value = festa.bairro || '';
    document.getElementById('edit-client-cidade').value = festa.cidade || '';
    document.getElementById('edit-client-estado').value = festa.estado || '';

    const descGlobalInput = document.getElementById('edit-party-desconto-global');
    const descGlobalType = document.getElementById('edit-party-desc-type');
    if(descGlobalInput) descGlobalInput.value = festa.descontoGlobal || 0;
    if(descGlobalType && festa.tipoDescontoGlobal) descGlobalType.value = festa.tipoDescontoGlobal;

    document.getElementById('edit-party-value').value = festa.valor || '';
    document.getElementById('edit-party-paid').value = festa.valorPago || 0; 
    document.getElementById('edit-party-staff').value = festa.equipe || '';

    const equipamentosSalvos = festa.equipamento ? festa.equipamento.split(', ') : [];
    const wrappers = document.querySelectorAll('#edit-party-eq-container .checkbox-item-wrapper');
    
    wrappers.forEach(w => {
        const cb = w.querySelector('input[type="checkbox"]');
        const eqNome = cb.value;
        const detailsDiv = w.querySelector('.eq-details');
        
        if (equipamentosSalvos.includes(eqNome)) {
            cb.checked = true;
            detailsDiv.classList.remove('hidden');
            
            if(festa.detalhesEquipamentos && festa.detalhesEquipamentos[eqNome]) {
                w.querySelector('.eq-valor').value = festa.detalhesEquipamentos[eqNome].valor;
                w.querySelector('.eq-desc').value = festa.detalhesEquipamentos[eqNome].desconto;
                w.querySelector('.eq-desc-type').value = festa.detalhesEquipamentos[eqNome].tipoDesconto || 'R$';
            }
        } else {
            cb.checked = false;
            detailsDiv.classList.add('hidden');
        }
    });
}

const formEditParty = document.getElementById('form-edit-party');
if(formEditParty) {
    formEditParty.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const wrappers = document.querySelectorAll('#edit-party-eq-container .checkbox-item-wrapper');
        let equipamentosSelecionados = [];
        let detalhesEquipamentos = {};

        wrappers.forEach(w => {
            const cb = w.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const nome = cb.value;
                equipamentosSelecionados.push(nome);
                detalhesEquipamentos[nome] = {
                    valor: parseFloat(w.querySelector('.eq-valor').value) || 0,
                    desconto: parseFloat(w.querySelector('.eq-desc').value) || 0,
                    tipoDesconto: w.querySelector('.eq-desc-type').value || 'R$'
                };
            }
        });

        if (equipamentosSelecionados.length === 0) { showToast("Selecione pelo menos um equipamento.", "error"); return; }

        const cbPausa = document.getElementById('edit-party-has-pause');
        const temPausa = cbPausa ? cbPausa.checked : false;

        const idFesta = document.getElementById('edit-party-id').value;
        const dadosAtualizados = {
            nome: document.getElementById('edit-party-name').value,
            endereco: document.getElementById('edit-party-address').value,
            equipamento: equipamentosSelecionados.join(', '), 
            detalhesEquipamentos: detalhesEquipamentos,
            data: document.getElementById('edit-party-date').value,
            horaInicio: document.getElementById('edit-party-start-time').value,
            horas: document.getElementById('edit-party-hours').value,
            horaFim: document.getElementById('edit-party-end-time').value,
            
            temPausa: temPausa,
            horasPausa: temPausa ? (parseFloat(document.getElementById('edit-party-pause-hours').value) || 0) : 0,
            valorPausa: temPausa ? (parseFloat(document.getElementById('edit-party-pause-cost').value) || 0) : 0,
            observacoes: document.getElementById('edit-party-obs').value || "",

            cliente: document.getElementById('edit-client-name').value,
            cpf: document.getElementById('edit-client-cpf').value,
            whatsapp: document.getElementById('edit-client-whatsapp').value,
            cep: document.getElementById('edit-client-cep').value,
            rua: document.getElementById('edit-client-rua').value,
            numero: document.getElementById('edit-client-numero').value,
            bairro: document.getElementById('edit-client-bairro').value,
            cidade: document.getElementById('edit-client-cidade').value,
            estado: document.getElementById('edit-client-estado').value,

            descontoGlobal: parseFloat(document.getElementById('edit-party-desconto-global').value) || 0,
            tipoDescontoGlobal: document.getElementById('edit-party-desc-type').value || 'R$',
            valor: parseFloat(document.getElementById('edit-party-value').value),
            valorPago: parseFloat(document.getElementById('edit-party-paid').value) || 0,
            equipe: document.getElementById('edit-party-staff').value || ""
        };

        const btnSubmit = formEditParty.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Atualizando...";
        btnSubmit.disabled = true;

        try {
            await updateFesta(idFesta, dadosAtualizados);
            if(editModal) editModal.classList.add('hidden');
            await carregarDadosGlobais();
            showToast("Festa atualizada com sucesso!", "success");
        } catch (error) { showToast("Erro ao atualizar os dados.", "error"); } 
        finally { btnSubmit.textContent = originalText; btnSubmit.disabled = false; }
    });
}

const formAddParty = document.getElementById('form-add-party');
if(formAddParty) {
    formAddParty.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const wrappers = document.querySelectorAll('#party-eq-container .checkbox-item-wrapper');
        let equipamentosSelecionados = [];
        let detalhesEquipamentos = {};

        wrappers.forEach(w => {
            const cb = w.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const nome = cb.value;
                equipamentosSelecionados.push(nome);
                detalhesEquipamentos[nome] = {
                    valor: parseFloat(w.querySelector('.eq-valor').value) || 0,
                    desconto: parseFloat(w.querySelector('.eq-desc').value) || 0,
                    tipoDesconto: w.querySelector('.eq-desc-type').value || 'R$'
                };
            }
        });

        if (equipamentosSelecionados.length === 0) { showToast("Selecione pelo menos um equipamento.", "error"); return; }

        const cbPausa = document.getElementById('party-has-pause');
        const temPausa = cbPausa ? cbPausa.checked : false;

        const novaFesta = {
            nome: document.getElementById('party-name').value,
            endereco: document.getElementById('party-address').value,
            equipamento: equipamentosSelecionados.join(', '), 
            detalhesEquipamentos: detalhesEquipamentos, 
            data: document.getElementById('party-date').value,
            horaInicio: document.getElementById('party-start-time').value,
            horas: document.getElementById('party-hours').value,
            horaFim: document.getElementById('party-end-time').value,
            
            temPausa: temPausa,
            horasPausa: temPausa ? (parseFloat(document.getElementById('party-pause-hours').value) || 0) : 0,
            valorPausa: temPausa ? (parseFloat(document.getElementById('party-pause-cost').value) || 0) : 0,
            observacoes: document.getElementById('party-obs').value || "",

            cliente: document.getElementById('client-name').value,
            cpf: document.getElementById('client-cpf').value,
            whatsapp: document.getElementById('client-whatsapp').value,
            cep: document.getElementById('client-cep').value,
            rua: document.getElementById('client-rua').value,
            numero: document.getElementById('client-numero').value,
            bairro: document.getElementById('client-bairro').value,
            cidade: document.getElementById('client-cidade').value,
            estado: document.getElementById('client-estado').value,

            descontoGlobal: parseFloat(document.getElementById('party-desconto-global').value) || 0,
            tipoDescontoGlobal: document.getElementById('party-desc-type').value || 'R$',
            valor: parseFloat(document.getElementById('party-value').value),
            valorPago: parseFloat(document.getElementById('party-paid').value) || 0, 
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
            formAddParty.reset();
            document.getElementById('party-end-time').value = ''; 
            
            document.querySelectorAll('#party-eq-container .eq-details').forEach(div => div.classList.add('hidden'));
            const pDetails = document.getElementById('party-pause-details');
            if(pDetails) pDetails.classList.add('hidden');

            await carregarDadosGlobais();
            showToast("Festa agendada com sucesso!", "success");
            const calBtn = document.querySelector('.menu-btn[data-view="view-calendar"]');
            if(calBtn) calBtn.click();
        } catch (error) { showToast("Erro ao agendar festa.", "error"); } 
        finally { btnSubmit.innerHTML = textoOriginal; btnSubmit.disabled = false; }
    });
}

// ========================================================
// REGISTRO DO SERVICE WORKER (TRANSFORMA EM APP INSTALÁVEL)
// ========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('App MabyEventos configurado para instalação!', reg.scope))
            .catch((err) => console.error('Erro ao configurar PWA:', err));
    });
}
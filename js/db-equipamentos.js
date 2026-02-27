// js/db-equipamentos.js

import { db } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const equipRef = collection(db, "equipamentos");

// SALVAR EQUIPAMENTO
export async function addEquipamento(dados) {
    try {
        const docRef = await addDoc(equipRef, dados);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao adicionar equipamento: ", error);
        throw error;
    }
}

// BUSCAR EQUIPAMENTOS
export async function getEquipamentos() {
    try {
        const querySnapshot = await getDocs(equipRef);
        const equipamentos = [];
        querySnapshot.forEach((doc) => {
            equipamentos.push({ id: doc.id, ...doc.data() });
        });
        return equipamentos; // Retorna em ordem de cadastro
    } catch (error) {
        console.error("Erro ao buscar equipamentos: ", error);
        throw error;
    }
}

// DELETAR EQUIPAMENTO
export async function deleteEquipamento(id) {
    try {
        await deleteDoc(doc(db, "equipamentos", id));
    } catch (error) {
        console.error("Erro ao deletar equipamento: ", error);
        throw error;
    }
}
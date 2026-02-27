// js/db-festas.js

import { db } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const festasRef = collection(db, "festas");

export async function addFesta(dadosDaFesta) {
    try {
        const docRef = await addDoc(festasRef, dadosDaFesta);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao adicionar festa: ", error);
        throw error; 
    }
}

export async function getFestas() {
    try {
        const q = query(festasRef, orderBy("data", "asc"));
        const querySnapshot = await getDocs(q);
        const festas = [];
        
        querySnapshot.forEach((doc) => {
            festas.push({ id: doc.id, ...doc.data() });
        });
        
        return festas;
    } catch (error) {
        console.error("Erro ao buscar festas: ", error);
        throw error;
    }
}

export async function updateFesta(id, dadosAtualizados) {
    try {
        const festaDoc = doc(db, "festas", id);
        await updateDoc(festaDoc, dadosAtualizados);
    } catch (error) {
        console.error("Erro ao atualizar festa: ", error);
        throw error;
    }
}

export async function deleteFesta(id) {
    try {
        const festaDoc = doc(db, "festas", id);
        await deleteDoc(festaDoc);
    } catch (error) {
        console.error("Erro ao deletar festa: ", error);
        throw error;
    }
}
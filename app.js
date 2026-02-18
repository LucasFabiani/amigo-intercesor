import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnkkL17pCQseNuVcsBTh-P2CJbf4nxuss",
    authDomain: "amigo-intercesor.firebaseapp.com",
    projectId: "amigo-intercesor",
    storageBucket: "amigo-intercesor.firebasestorage.app",
    messagingSenderId: "313076200944",
    appId: "1:313076200944:web:a00d3ab29d8014278f1935",
    measurementId: "G-YDJX2BNSN6"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getSessionId() {
  let id = localStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sessionId", id);
  }
  return id;
}

const sessionId = getSessionId();

const groupList = document.getElementById("groupList");
const createGroupBtn = document.getElementById("createGroupBtn");
const groupNameInput = document.getElementById("groupName");

const groupSection = document.getElementById("groupSection");
const groupTitle = document.getElementById("groupTitle");
const deleteGroupBtn = document.getElementById("deleteGroupBtn");
const joinBtn = document.getElementById("joinBtn");
const participantName = document.getElementById("participantName");
const participantIntention = document.getElementById("participantIntention");
const participantsDiv = document.getElementById("participants");
const drawBtn = document.getElementById("drawBtn");
const resultDiv = document.getElementById("result");
const joinSection = document.getElementById("joinSection");

let currentGroupId = null;
let currentParticipants = [];

async function loadGroups() {
  const snapshot = await getDocs(collection(db, "groups"));
  groupList.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const btn = document.createElement("button");
    btn.className = "group-btn";
    btn.textContent = data.name;
    btn.onclick = () => openGroup(docSnap.id, data);
    groupList.appendChild(btn);
  });
}

createGroupBtn.onclick = async () => {
  const name = groupNameInput.value.trim();
  if (!name) return;

  const snapshot = await getDocs(collection(db, "groups"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());

  if (exists) {
    alert("Ya existe un grupo con ese nombre");
    return;
  }

  await addDoc(collection(db, "groups"), {
    name,
    adminSessionId: sessionId,
    createdAt: serverTimestamp()
  });

  groupNameInput.value = "";
  loadGroups();
};

function openGroup(groupId, groupData) {
  currentGroupId = groupId;
  groupSection.style.display = "block";
  groupTitle.textContent = groupData.name;

  deleteGroupBtn.style.display = groupData.adminSessionId === sessionId ? "inline-block" : "none";
  drawBtn.style.display = groupData.adminSessionId === sessionId ? "inline-block" : "none";

  listenParticipants();
  listenAssignments();
}

deleteGroupBtn.onclick = async () => {
  if (!confirm("¿Seguro que deseas eliminar el grupo?") ) return;
  await deleteDoc(doc(db, "groups", currentGroupId));
  groupSection.style.display = "none";
  loadGroups();
};

joinBtn.onclick = async () => {
  if (!participantName.value || !participantIntention.value) return;

  await addDoc(collection(db, "groups", currentGroupId, "participants"), {
    name: participantName.value,
    intention: participantIntention.value,
    sessionId,
    createdAt: serverTimestamp()
  });

  joinSection.style.display = "none";
};

function listenParticipants() {
  onSnapshot(collection(db, "groups", currentGroupId, "participants"), snapshot => {
    participantsDiv.innerHTML = "";
    currentParticipants = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      currentParticipants.push({ id: docSnap.id, ...data });

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<strong>${data.name}</strong>`;
      participantsDiv.appendChild(card);

      if (data.sessionId === sessionId) {
        joinSection.style.display = "none";
      }
    });
  });
}

function derangement(n) {
  const arr = [...Array(n).keys()];
  let shuffled;
  do {
    shuffled = [...arr].sort(() => Math.random() - 0.5);
  } while (shuffled.some((v, i) => v === i));
  return shuffled;
}

drawBtn.onclick = async () => {
  if (currentParticipants.length < 2) return alert("Mínimo 2 participantes");

  const indices = derangement(currentParticipants.length);

  const pairs = indices.map((toIndex, fromIndex) => ({
    from: currentParticipants[fromIndex].id,
    to: currentParticipants[toIndex].id
  }));

  await setDoc(doc(db, "groups", currentGroupId, "assignments", "current"), {
    pairs,
    createdAt: serverTimestamp()
  });
};

function listenAssignments() {
  onSnapshot(doc(db, "groups", currentGroupId, "assignments", "current"), docSnap => {
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const me = currentParticipants.find(p => p.sessionId === sessionId);
    if (!me) return;

    const pair = data.pairs.find(p => p.from === me.id);
    if (!pair) return;

    const assigned = currentParticipants.find(p => p.id === pair.to);
    if (!assigned) return;

    resultDiv.innerHTML = `
      <h3>Te toca rezar por:</h3>
      <p><strong>${assigned.name}</strong></p>
      <p>Intención: ${assigned.intention}</p>
      <p><em>"Soportense mutuamente" (Col 3, 13)</em></p>
    `;
  });
}

loadGroups();
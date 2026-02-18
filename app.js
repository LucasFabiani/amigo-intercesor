import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const groupNameInput = document.getElementById("groupName");
const createGroupBtn = document.getElementById("createGroupBtn");
const groupSection = document.getElementById("groupSection");
const groupTitle = document.getElementById("groupTitle");
const participantsDiv = document.getElementById("participants");
const joinBtn = document.getElementById("joinBtn");
const participantName = document.getElementById("participantName");
const participantIntention = document.getElementById("participantIntention");
const resultDiv = document.getElementById("result");
const drawBtn = document.getElementById("drawBtn");
const deleteGroupBtn = document.getElementById("deleteGroupBtn");
const leaveBtn = document.getElementById("leaveBtn");
const editIntentionBtn = document.getElementById("editIntentionBtn");
const autoDrawCheck = document.getElementById("autoDrawCheck");

let currentGroupId = null;
let myParticipantId = null;
let participants = [];

async function loadGroups() {
  const snapshot = await getDocs(collection(db, "groups"));
  groupList.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const btn = document.createElement("button");
    btn.textContent = data.name;
    btn.onclick = () => openGroup(docSnap.id);
    groupList.appendChild(btn);
  });
}

createGroupBtn.onclick = async () => {
  const name = groupNameInput.value.trim();
  if (!name) return;

  const snapshot = await getDocs(collection(db, "groups"));
  const exists = snapshot.docs.some(d =>
    d.data().name?.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    alert("Ya existe ese grupo");
    return;
  }

  await addDoc(collection(db, "groups"), {
    name,
    adminSessionId: sessionId,
    autoWeekly: false,
    createdAt: serverTimestamp()
  });

  groupNameInput.value = "";
  loadGroups();
};

async function openGroup(groupId) {
  currentGroupId = groupId;
  groupSection.style.display = "block";

  const groupDoc = await getDoc(doc(db, "groups", groupId));
  const groupData = groupDoc.data();

  groupTitle.textContent = groupData.name;

  deleteGroupBtn.style.display = groupData.adminSessionId === sessionId ? "block" : "none";
  drawBtn.style.display = groupData.adminSessionId === sessionId ? "block" : "none";

  listenParticipants();
  listenAssignments();
}

joinBtn.onclick = async () => {
  const name = participantName.value;
  const intention = participantIntention.value;
  if (!name || !intention) return;

  const docRef = await addDoc(collection(db, "groups", currentGroupId, "participants"), {
    name,
    intention,
    sessionId,
    createdAt: serverTimestamp()
  });

  myParticipantId = docRef.id;
};

function listenParticipants() {
  onSnapshot(collection(db, "groups", currentGroupId, "participants"), snapshot => {
    participantsDiv.innerHTML = "";
    participants = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      participants.push({ id: docSnap.id, ...data });

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<strong>${data.name}</strong>`;
      participantsDiv.appendChild(card);

      if (data.sessionId === sessionId) {
        myParticipantId = docSnap.id;
        joinBtn.style.display = "none";
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

async function draw() {
  if (participants.length < 2) return;
  const indices = derangement(participants.length);

  const pairs = indices.map((toIndex, fromIndex) => ({
    from: participants[fromIndex].id,
    to: participants[toIndex].id
  }));

  await setDoc(doc(db, "groups", currentGroupId, "assignments", "current"), {
    pairs,
    createdAt: serverTimestamp()
  });
}

drawBtn.onclick = draw;

function listenAssignments() {
  onSnapshot(doc(db, "groups", currentGroupId, "assignments", "current"), docSnap => {
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const pair = data.pairs.find(p => p.from === myParticipantId);
    if (!pair) return;

    const assigned = participants.find(p => p.id === pair.to);
    if (!assigned) return;

    resultDiv.innerHTML = `
      <h3>Te toca rezar por:</h3>
      <p><strong>${assigned.name}</strong></p>
      <p><em>"Soportense mutuamente" (Col 3, 13)</em></p>
    `;
  });
}

loadGroups();
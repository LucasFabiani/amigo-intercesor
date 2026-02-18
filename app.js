import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  doc, deleteDoc, setDoc, updateDoc,
  getDoc, onSnapshot, serverTimestamp
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

const isGroupPage = window.location.pathname.includes("group.html");

if (!isGroupPage) initHome();
else initGroup();

// ---------- HOME ----------

async function initHome() {
  const groupList = document.getElementById("groupList");
  const createBtn = document.getElementById("createGroupBtn");
  const groupNameInput = document.getElementById("groupName");

  const snapshot = await getDocs(collection(db, "groups"));
  snapshot.forEach(docSnap => {
    const btn = document.createElement("button");
    btn.textContent = docSnap.data().name;
    btn.onclick = () => {
      window.location.href = `group.html?id=${docSnap.id}`;
    };
    groupList.appendChild(btn);
  });

  createBtn.onclick = async () => {
    const name = groupNameInput.value.trim();
    if (!name) return;

    const newDoc = await addDoc(collection(db, "groups"), {
      name,
      adminSessionId: sessionId,
      createdAt: serverTimestamp()
    });

    window.location.href = `group.html?id=${newDoc.id}`;
  };
}

// ---------- GROUP ----------

async function initGroup() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) return;

  const groupTitle = document.getElementById("groupTitle");
  const joinBtn = document.getElementById("joinBtn");
  const participantName = document.getElementById("participantName");
  const participantIntention = document.getElementById("participantIntention");
  const participantsDiv = document.getElementById("participants");
  const resultDiv = document.getElementById("result");
  const leaveBtn = document.getElementById("leaveBtn");
  const editBtn = document.getElementById("editIntentionBtn");
  const deleteGroupBtn = document.getElementById("deleteGroupBtn");
  const drawBtn = document.getElementById("drawBtn");

  const groupDoc = await getDoc(doc(db, "groups", groupId));
  const groupData = groupDoc.data();
  groupTitle.textContent = groupData.name;

  let myId = null;
  let participants = [];

  onSnapshot(collection(db, "groups", groupId, "participants"), snapshot => {
    participantsDiv.innerHTML = "";
    participants = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      participants.push({ id: docSnap.id, ...data });

      if (data.sessionId === sessionId) {
        myId = docSnap.id;
        document.getElementById("joinSection").style.display = "none";
        leaveBtn.style.display = "block";
        editBtn.style.display = "block";
      }

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<strong>${data.name}</strong>`;

      if (groupData.adminSessionId === sessionId) {
        const del = document.createElement("button");
        del.textContent = "Eliminar";
        del.onclick = () => deleteDoc(doc(db, "groups", groupId, "participants", docSnap.id));
        card.appendChild(del);
      }

      participantsDiv.appendChild(card);
    });
  });

  joinBtn.onclick = async () => {
    if (myId) return;
    await addDoc(collection(db, "groups", groupId, "participants"), {
      name: participantName.value,
      intention: participantIntention.value,
      sessionId,
      createdAt: serverTimestamp()
    });
  };

  editBtn.onclick = async () => {
    const newIntention = prompt("Nueva intención:");
    if (!newIntention) return;
    await updateDoc(doc(db, "groups", groupId, "participants", myId), {
      intention: newIntention
    });
  };

  leaveBtn.onclick = async () => {
    await deleteDoc(doc(db, "groups", groupId, "participants", myId));
    window.location.reload();
  };

  deleteGroupBtn.onclick = async () => {
    if (groupData.adminSessionId !== sessionId) return;
    await deleteDoc(doc(db, "groups", groupId));
    window.location.href = "index.html";
  };

  drawBtn.onclick = async () => {
    if (participants.length < 2) return;

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const pairs = participants.map((p, i) => ({
      from: p.id,
      to: shuffled[i].id
    }));

    await setDoc(doc(db, "groups", groupId, "assignments", "current"), { pairs });
  };

  onSnapshot(doc(db, "groups", groupId, "assignments", "current"), snap => {
    if (!snap.exists()) return;
    const pair = snap.data().pairs.find(p => p.from === myId);
    if (!pair) return;

    const assigned = participants.find(p => p.id === pair.to);
    if (!assigned) return;

    resultDiv.innerHTML = `
      <h3>Te toca rezar por:</h3>
      <p><strong>${assigned.name}</strong></p>
      <p>${assigned.intention}</p>
      <p><em>"Soportense mutuamente" (Col 3, 13)</em></p>
    `;
  });
}
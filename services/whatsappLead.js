const sessions = new Map();

function getLeadSession(phone) {
  const key = String(phone || "").trim();

  if (!key) {
    return null;
  }

  if (!sessions.has(key)) {
    sessions.set(key, {
      phone: key,
      state: "idle",
      name: "",
      requirement: ""
    });
  }

  return sessions.get(key);
}

function clearLeadSession(phone) {
  const key = String(phone || "").trim();

  if (!key) {
    return false;
  }

  return sessions.delete(key);
}

function startLeadCapture(phone) {
  const session = getLeadSession(phone);

  if (!session) {
    return null;
  }

  session.state = "awaiting_name";
  return session;
}

function completeLeadCapture(phone, name, requirement = "") {
  const session = getLeadSession(phone);

  if (!session) {
    return null;
  }

  session.name = String(name || "").trim();
  session.requirement = String(requirement || "").trim();
  session.state = "completed";

  return session;
}

function createLeadPayload(session) {
  if (!session || session.state !== "completed") {
    return null;
  }

  const name = String(session.name || "").trim();
  const phone = String(session.phone || "").trim();
  const requirement = String(session.requirement || "").trim();

  if (!name || !phone) {
    return null;
  }

  return {
    name,
    phone,
    requirement
  };
}

export {
  getLeadSession,
  clearLeadSession,
  startLeadCapture,
  completeLeadCapture,
  createLeadPayload
};

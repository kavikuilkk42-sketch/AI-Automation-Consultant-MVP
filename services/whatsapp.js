function normalizeWhatsAppMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const from = String(payload.from || "").trim();
  const message = String(payload.message || "").trim();

  if (!from || !message) {
    return null;
  }

  return {
    from,
    message
  };
}

function createWhatsAppReply(from, reply) {
  return {
    to: String(from || "").trim(),
    message: String(reply || "").trim()
  };
}

export {
  normalizeWhatsAppMessage,
  createWhatsAppReply
};

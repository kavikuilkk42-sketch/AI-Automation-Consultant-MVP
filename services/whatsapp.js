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

function normalizeMetaWhatsAppMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const message =
    payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return null;
  }

  const from = String(message.from || "").trim();
  const text = String(message.text?.body || "").trim();

  if (!from || !text) {
    return null;
  }

  return {
    from,
    message: text
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
  normalizeMetaWhatsAppMessage,
  createWhatsAppReply
};

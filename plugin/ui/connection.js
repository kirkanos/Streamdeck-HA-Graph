/**
 * "Home Assistant connection" section of the property inspector.
 *
 * The plugin owns the connection: this page sends URL and long-lived access
 * token once ({ event: "connect" }) and shows the status the plugin reports
 * back ({ event: "status" }). Both are kept in the plugin's global settings.
 */
(function () {
  const client = SDPIComponents.streamDeckClient;
  const $ = (id) => document.getElementById(id);

  const STATE_TEXT = {
    connected: "Connected",
    connecting: "Checking connection…",
    error: "Connection problem",
    unconfigured: "Not configured",
  };

  function send(payload) {
    client.send("sendToPlugin", payload);
  }

  function showMessage(text, kind) {
    const box = $("ha-message");
    box.textContent = text || "";
    box.className = `message ${kind || ""}`;
    box.hidden = !text;
  }

  let editing = false;

  function renderStatus(status) {
    const badge = $("ha-status");
    badge.className = `status ${status.state}`;
    $("ha-status-text").textContent = STATE_TEXT[status.state] || status.state;
    $("ha-status-detail").textContent = status.error
      ? status.error
      : status.state === "connected"
        ? `${status.url} · ${status.name}`
        : status.url || "Enter your Home Assistant URL and a long-lived access token.";

    const showForm = !status.configured || editing;
    $("ha-form").hidden = !showForm;
    $("ha-edit").hidden = showForm;
    for (const el of document.querySelectorAll(".requires-connection")) {
      el.hidden = !status.configured;
    }
    if (status.url && !$("ha-url").value) {
      $("ha-url").value = status.url;
    }
    $("ha-token").placeholder = status.configured ? "Leave empty to keep the current token" : "eyJ…";
  }

  client.sendToPropertyInspector.subscribe((message) => {
    const payload = message.payload || {};
    if (payload.event === "status") {
      renderStatus(payload);
    } else if (payload.event === "connect") {
      $("ha-connect").disabled = false;
      if (payload.ok) {
        editing = false;
        showMessage(`Connected to ${payload.name}`, "success");
        $("ha-token").value = "";
      } else {
        showMessage(payload.error, "error");
      }
      send({ event: "getStatus" });
    }
  });

  const TEMPLATE = `
    <sdpi-item label="Home Assistant">
      <div id="ha-status" class="status unconfigured">
        <div><strong id="ha-status-text">…</strong><span id="ha-status-detail"></span></div>
      </div>
    </sdpi-item>
    <div id="ha-message" class="message" hidden></div>
    <div id="ha-form" hidden>
      <sdpi-item label="URL"><sdpi-textfield id="ha-url" placeholder="https://homeassistant.local:8123"></sdpi-textfield></sdpi-item>
      <sdpi-item label="Token"><sdpi-password id="ha-token" placeholder="eyJ…"></sdpi-password></sdpi-item>
      <sdpi-item><sdpi-button id="ha-connect">Save and test connection</sdpi-button></sdpi-item>
      <p class="hint">
        Create a long-lived access token in Home Assistant (your profile → Security → Long-lived access tokens). The token is stored in the Stream Deck settings on this computer only.
      </p>
    </div>
    <div id="ha-edit" hidden>
      <sdpi-item><sdpi-button id="ha-edit-button">Change connection</sdpi-button></sdpi-item>
    </div>`;

  window.addEventListener("DOMContentLoaded", () => {
    $("ha-connection").innerHTML = TEMPLATE;

    $("ha-connect").addEventListener("click", () => {
      const url = ($("ha-url").value || "").trim();
      const token = ($("ha-token").value || "").trim();
      if (!url) {
        showMessage("Please enter the Home Assistant URL", "error");
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        showMessage("The URL must start with http:// or https://", "error");
        return;
      }
      showMessage("Testing connection…", "");
      $("ha-connect").disabled = true;
      send({ event: "connect", url, token });
    });

    $("ha-edit-button").addEventListener("click", () => {
      editing = true;
      showMessage("", "");
      send({ event: "getStatus" });
    });

    send({ event: "getStatus" });
  });
})();


// ========================================
// VEDA TECHNOLOGY SECURITY PORTAL
// JAVASCRIPT FUNCTIONALITY
// ========================================

const $ = (selector) => document.querySelector(selector);

const today = new Date();

$("#today").textContent = today.toLocaleDateString(
    "en-IN",
    {
        day: "numeric",
        month: "short",
        year: "numeric"
    }
);


// ========================================
// PAGE NAVIGATION
// ========================================

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    document.querySelectorAll(".nav").forEach(button => {
        button.classList.remove("active");
    });

    document.getElementById(pageId).classList.add("active");

    const titles = {
        dashboard: "Dashboard",
        awareness: "Security Awareness",
        checklists: "Security Checklists",
        assets: "Asset Inventory",
        risks: "Risk Assessment",
        incidents: "Incident Reporting",
        reports: "Reports"
    };

    $("#page-title").textContent = titles[pageId];

    const activeButton = [...document.querySelectorAll(".nav")]
        .find(button => button.getAttribute("onclick")?.includes(pageId));

    if (activeButton) {
        activeButton.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}


// ========================================
// API CONNECTION
// ========================================

async function api(url, options = {}) {

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}


// ========================================
// DASHBOARD
// ========================================

let riskChart = null;

async function loadDashboard() {

    const data = await api("/api/dashboard");

    $("#assetCount").textContent = data.assets;
    $("#riskCount").textContent = data.risks;
    $("#highCount").textContent = data.high;
    $("#incidentCount").textContent = data.open_incidents;

    const canvas = $("#riskChart");

    if (riskChart) {
        riskChart.destroy();
    }

    riskChart = new Chart(canvas, {

        type: "doughnut",

        data: {

            labels: ["Low Risk", "Medium Risk", "High Risk"],

            datasets: [{
                data: [
                    data.distribution.Low,
                    data.distribution.Medium,
                    data.distribution.High
                ],

                backgroundColor: [
                    "#319b78",
                    "#e9a45d",
                    "#df6d69"
                ],

                borderWidth: 0
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    const recent = $("#recentRisks");

    if (data.recent.length === 0) {

        recent.innerHTML =
            "<p class='muted'>No risk assessments recorded yet.</p>";

    } else {

        recent.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>RISK</th>
                        <th>SCORE</th>
                        <th>LEVEL</th>
                    </tr>
                </thead>

                <tbody>
                    ${data.recent.map(r => `
                        <tr>
                            <td>${escapeHTML(r.title)}</td>
                            <td>${r.score}/25</td>
                            <td>${badge(r.level)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    await Promise.all([
        loadAssets(),
        loadRisks(),
        loadIncidents()
    ]);
}


// ========================================
// HTML SAFETY HELPERS
// ========================================

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );
}

function badge(level) {

    const safeLevel = escapeHTML(level);

    return `
        <span class="badge ${safeLevel.toLowerCase()}">
            ${safeLevel}
        </span>
    `;
}


// ========================================
// ASSET INVENTORY
// ========================================

async function loadAssets() {

    const assets = await api("/api/assets");

    const table = $("#assetsTable");

    if (!assets.length) {

        table.innerHTML = "<p>No assets registered.</p>";
        return;
    }

    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ASSET NAME</th>
                    <th>CATEGORY</th>
                    <th>OWNER</th>
                    <th>SENSITIVITY</th>
                    <th>ACTION</th>
                </tr>
            </thead>

            <tbody>

                ${assets.map(asset => `
                    <tr>
                        <td>
                            <b>${escapeHTML(asset.name)}</b>
                            <br>
                            <small>${escapeHTML(asset.notes)}</small>
                        </td>

                        <td>${escapeHTML(asset.category)}</td>

                        <td>${escapeHTML(asset.owner)}</td>

                        <td>${badge(asset.sensitivity)}</td>

                        <td>
                            <button
                                class="delete-btn"
                                onclick="deleteAsset(${asset.id})">
                                Delete
                            </button>
                        </td>
                    </tr>
                `).join("")}

            </tbody>
        </table>
    `;
}


$("#assetForm").addEventListener("submit", async function(event) {

    event.preventDefault();

    const formData = new FormData(this);

    const data = Object.fromEntries(formData);

    try {

        const result = await api("/api/assets", {
            method: "POST",
            body: JSON.stringify(data)
        });

        $("#assetMessage").textContent = result.message;

        this.reset();

        await loadDashboard();

    } catch(error) {

        $("#assetMessage").textContent = error.message;
    }
});


async function deleteAsset(id) {

    if (!confirm("Are you sure you want to delete this asset?")) {
        return;
    }

    try {

        await api(`/api/assets/${id}`, {
            method: "DELETE"
        });

        await loadDashboard();

    } catch(error) {

        alert(error.message);
    }
}


// ========================================
// RISK ASSESSMENT CALCULATOR
// ========================================

function calculateRisk() {

    const form = $("#riskForm");

    const likelihood = Number(form.elements["likelihood"].value);

    const impact = Number(form.elements["impact"].value);

    const score = likelihood * impact;

    let level;

    if (score <= 5) {

        level = "Low";

    } else if (score <= 12) {

        level = "Medium";

    } else {

        level = "High";
    }

    $("#riskScore").textContent = score + "/25";

    $("#riskLevel").textContent = level.toUpperCase();

    $("#riskLevel").className =
        "badge " + level.toLowerCase();
}


$("#riskForm").elements["likelihood"].addEventListener(
    "change",
    calculateRisk
);

$("#riskForm").elements["impact"].addEventListener(
    "change",
    calculateRisk
);


$("#riskForm").addEventListener("submit", async function(event) {

    event.preventDefault();

    const data = Object.fromEntries(
        new FormData(this)
    );

    try {

        const result = await api("/api/risks", {

            method: "POST",

            body: JSON.stringify(data)

        });

        $("#riskMessage").textContent =
            `Risk saved! Score: ${result.score}/25. Level: ${result.level}.`;

        this.reset();

        calculateRisk();

        await loadDashboard();

    } catch(error) {

        $("#riskMessage").textContent = error.message;
    }
});


// ========================================
// DISPLAY RISK REGISTER
// ========================================

async function loadRisks() {

    const risks = await api("/api/risks");

    if (!risks.length) {

        $("#risksTable").innerHTML =
            "<p>No risks recorded yet.</p>";

        return;
    }

    $("#risksTable").innerHTML = `

        <table>

            <thead>
                <tr>
                    <th>RISK</th>
                    <th>ASSET</th>
                    <th>LIKELIHOOD</th>
                    <th>IMPACT</th>
                    <th>SCORE</th>
                    <th>LEVEL</th>
                    <th>MITIGATION</th>
                </tr>
            </thead>

            <tbody>

                ${risks.map(risk => `
                    <tr>
                        <td>${escapeHTML(risk.title)}</td>

                        <td>${escapeHTML(risk.asset)}</td>

                        <td>${risk.likelihood}</td>

                        <td>${risk.impact}</td>

                        <td>${risk.score}/25</td>

                        <td>${badge(risk.level)}</td>

                        <td>${escapeHTML(risk.mitigation)}</td>
                    </tr>
                `).join("")}

            </tbody>

        </table>
    `;
}


// ========================================
// INCIDENT REPORTING
// ========================================

$("#incidentForm").addEventListener("submit", async function(event) {

    event.preventDefault();

    const data = Object.fromEntries(
        new FormData(this)
    );

    try {

        const result = await api("/api/incidents", {

            method: "POST",

            body: JSON.stringify(data)

        });

        $("#incidentMessage").textContent = result.message;

        this.reset();

        await loadDashboard();

    } catch(error) {

        $("#incidentMessage").textContent = error.message;
    }
});


// ========================================
// INCIDENT REGISTER
// ========================================

async function loadIncidents() {

    const incidents = await api("/api/incidents");

    if (!incidents.length) {

        $("#incidentsTable").innerHTML =
            "<p>No incident reports recorded.</p>";

        return;
    }

    $("#incidentsTable").innerHTML = `

        <table>

            <thead>
                <tr>
                    <th>DATE</th>
                    <th>REPORTER</th>
                    <th>INCIDENT TYPE</th>
                    <th>URGENCY</th>
                    <th>STATUS</th>
                </tr>
            </thead>

            <tbody>

                ${incidents.map(item => `
                    <tr>

                        <td>${escapeHTML(item.created_at.slice(0,10))}</td>

                        <td>${escapeHTML(item.reporter)}</td>

                        <td>
                            ${escapeHTML(item.incident_type)}
                            <br>
                            <small>${escapeHTML(item.description)}</small>
                        </td>

                        <td>${badge(item.urgency)}</td>

                        <td>${escapeHTML(item.status)}</td>

                    </tr>
                `).join("")}

            </tbody>

        </table>
    `;
}


// ========================================
// SECURITY AWARENESS QUIZ
// ========================================

$("#quizForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const form = new FormData(this);

    let score = 0;

    const totalQuestions = 4;

    for (let i = 1; i <= totalQuestions; i++) {

        if (!form.has("q" + i)) {

            $("#quizResult").textContent =
                "Please answer all four questions.";

            return;
        }

        score += Number(form.get("q" + i));
    }

    let message;

    if (score === 4) {

        message = "Excellent! You have strong basic security awareness.";

    } else if (score >= 2) {

        message = "Good attempt! Review the awareness material and improve.";

    } else {

        message = "Please review the cybersecurity awareness lessons.";
    }

    $("#quizResult").textContent =
        `Your score: ${score}/${totalQuestions}. ${message}`;
});


// ========================================
// SECURITY CHECKLISTS
// ========================================

const checklistData = {

    passwordChecklist: [
        "I use unique passwords for important accounts.",
        "I use an approved password manager.",
        "I enable multi-factor authentication.",
        "I never share passwords or verification codes.",
        "I report suspected account compromise."
    ],

    deviceChecklist: [
        "My device has current security updates.",
        "My screen locks when unattended.",
        "I use approved endpoint protection.",
        "I avoid unknown USB devices.",
        "I use approved services for work files."
    ]

};


function createChecklist(elementId, items, progressId) {

    const container = document.getElementById(elementId);

    container.innerHTML = items.map((item, index) => `

        <label class="check-item">

            <input
                type="checkbox"
                onchange="updateProgress('${elementId}','${progressId}')"
            >

            <span>${escapeHTML(item)}</span>

        </label>

    `).join("");

}


function updateProgress(elementId, progressId) {

    const checkboxes = document.querySelectorAll(
        `#${elementId} input[type="checkbox"]`
    );

    const completed = [...checkboxes].filter(
        checkbox => checkbox.checked
    ).length;

    document.getElementById(progressId).textContent =
        `${completed}/${checkboxes.length} completed`;
}


createChecklist(
    "passwordChecklist",
    checklistData.passwordChecklist,
    "passwordProgress"
);

createChecklist(
    "deviceChecklist",
    checklistData.deviceChecklist,
    "deviceProgress"
);


// ========================================
// INITIALIZE APPLICATION
// ========================================

calculateRisk();

loadDashboard().catch(error => {

    console.error("Dashboard loading error:", error);

    alert(
        "Unable to load project data. Check that the Flask server is running."
    );

});

const STORAGE_KEY = "transactions";

const amountFormatter = new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

function formatRupees(amount) {
    return `Rs. ${amountFormatter.format(amount)}`;
}

// Ignore malformed or outdated data rather than breaking the entire app on load.
function loadTransactions() {
    let storedValue;

    try {
        storedValue = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        console.warn("Could not read saved transactions.", error);
        return [];
    }

    if (!storedValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(storedValue);

        if (!Array.isArray(parsed)) {
            console.warn("Saved transactions were not a list. Starting fresh.");
            return [];
        }

        return parsed.filter(isValidTransaction);
    } catch (error) {
        console.warn("Saved transactions were invalid JSON. Starting fresh.", error);
        return [];
    }
}

function isValidTransaction(transaction) {
    return transaction !== null
        && typeof transaction === "object"
        && Number.isFinite(transaction.id)
        && typeof transaction.title === "string"
        && Number.isFinite(transaction.amount)
        && transaction.amount > 0
        && ["income", "expense"].includes(transaction.type)
        && typeof transaction.category === "string";
}

let transactions = loadTransactions();
let editingTransactionId = null;
let lastDeletedTransaction = null;

let currentFilter = "all";


// DOM Elements

const form =
    document.getElementById("transactionForm");

const titleInput =
    document.getElementById("title");

const amountInput =
    document.getElementById("amount");

const typeInput =
    document.getElementById("type");

const categoryInput =
    document.getElementById("category");

const transactionList =
    document.getElementById("transactionList");

const searchInput =
    document.getElementById("search");

const exportCsvButton =
    document.getElementById("exportCsvBtn");

const emptyMessage =
    document.getElementById("emptyMessage");

// Accessible undo notice, inserted above the transaction list.
const undoNotice = document.createElement("div");
undoNotice.setAttribute("role", "status");
undoNotice.setAttribute("aria-live", "polite");
undoNotice.style.display = "none";
undoNotice.style.alignItems = "center";
undoNotice.style.justifyContent = "space-between";
undoNotice.style.flexWrap = "wrap";
undoNotice.style.gap = "12px";
undoNotice.style.margin = "12px 0";
undoNotice.style.padding = "12px 14px";
undoNotice.style.border = "1px solid #bfdbfe";
undoNotice.style.borderRadius = "8px";
undoNotice.style.background = "#eff6ff";
undoNotice.style.color = "#1e3a8a";

const undoMessage = document.createElement("span");
const undoButton = document.createElement("button");
undoButton.type = "button";
undoButton.className = "filter-btn";
undoButton.textContent = "Undo delete";
undoNotice.append(undoMessage, undoButton);
transactionList.parentElement.insertBefore(undoNotice, transactionList);

undoButton.addEventListener("click", function () {
    if (!lastDeletedTransaction) {
        return;
    }

    const previousTransactions = transactions;
    transactions = [...transactions, lastDeletedTransaction];

    if (!saveTransactions()) {
        transactions = previousTransactions;
        return;
    }

    lastDeletedTransaction = null;
    undoNotice.style.display = "none";
    undoMessage.textContent = "";

    // Show the restored transaction even if a filter or search was active.
    currentFilter = "all";
    searchInput.value = "";
    document.querySelectorAll(".filter-btn[data-filter]").forEach(button => {
        button.classList.toggle("active", button.dataset.filter === "all");
    });

    calculateSummary();
    displayTransactions();
});

const formHeading = form.closest(".card").querySelector("h2");
const submitButton = form.querySelector('button[type="submit"]');

// Create the cancel control dynamically so no HTML change is needed.
const cancelEditButton = document.createElement("button");
cancelEditButton.type = "button";
cancelEditButton.className = "filter-btn";
cancelEditButton.textContent = "Cancel edit";
cancelEditButton.hidden = true;
cancelEditButton.style.gridColumn = "1 / -1";
form.appendChild(cancelEditButton);

function resetTransactionForm() {
    editingTransactionId = null;
    form.reset();
    formHeading.textContent = "Add Transaction";
    submitButton.textContent = "Add Transaction";
    cancelEditButton.hidden = true;
}

function startEditingTransaction(transaction) {
    editingTransactionId = transaction.id;
    titleInput.value = transaction.title;
    amountInput.value = transaction.amount;
    typeInput.value = transaction.type;
    categoryInput.value = transaction.category;
    formHeading.textContent = "Edit Transaction";
    submitButton.textContent = "Save Changes";
    cancelEditButton.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

cancelEditButton.addEventListener("click", resetTransactionForm);


// Save data

function saveTransactions() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(transactions)
        );
        return true;
    } catch (error) {
        console.error("Could not save transactions.", error);
        alert(
            "Your changes could not be saved in this browser. " +
            "Check browser storage availability and try again."
        );
        return false;
    }
}


// Calculate summary

function calculateSummary() {

    let income = 0;
    let expense = 0;

    transactions.forEach(transaction => {

        if (transaction.type === "income") {

            income += transaction.amount;

        } else {

            expense += transaction.amount;

        }

    });

    const balance = income - expense;

    document.getElementById("income")
        .textContent =
        formatRupees(income);

    document.getElementById("expense")
        .textContent =
        formatRupees(expense);

    document.getElementById("balance")
        .textContent =
        formatRupees(balance);
}


// Display transactions

function displayTransactions() {

    transactionList.innerHTML = "";

    const searchText =
        searchInput.value.toLowerCase().trim();

    // Let users search amounts with or without thousands separators/currency text.
    const normalizedSearch = searchText
        .replace(/rs\.?/g, "")
        .replace(/[\s,]/g, "");

    const filteredTransactions =
        transactions.filter(transaction => {

            const matchesFilter =
                currentFilter === "all" ||
                transaction.type === currentFilter;

            // Search by description, category, type, or amount.
            const matchesSearch =
                transaction.title
                    .toLowerCase()
                    .includes(searchText) ||
                transaction.category
                    .toLowerCase()
                    .includes(searchText) ||
                transaction.type
                    .toLowerCase()
                    .includes(searchText) ||
                String(transaction.amount)
                    .includes(normalizedSearch);

            return matchesFilter && matchesSearch;

        })
        // Show the newest transactions first (IDs are created with Date.now()).
        .sort((a, b) => b.id - a.id);


    if (filteredTransactions.length === 0) {

        emptyMessage.style.display = "block";

        return;

    }


    emptyMessage.style.display = "none";


    filteredTransactions.forEach(transaction => {

        const li =
            document.createElement("li");

        li.classList.add(
            "transaction",
            transaction.type
        );


        const sign =
            transaction.type === "income"
                ? "+"
                : "-";

        const createdAt = new Date(transaction.id).toLocaleString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });


        li.innerHTML = `

            <div class="transaction-info">

                <h4>
                    ${escapeHTML(transaction.title)}
                </h4>

                <small>
                    ${escapeHTML(transaction.category)}
                </small>
                <small class="transaction-date">
                    Added ${escapeHTML(createdAt)}
                </small>

            </div>


            <span class="transaction-amount">

                ${sign}
                ${formatRupees(transaction.amount)}

            </span>


            <button
                type="button"
                class="filter-btn edit-btn"
                data-id="${transaction.id}"
                aria-label="Edit transaction">

                Edit

            </button>

            <button
                type="button"
                class="delete-btn"
                data-id="${transaction.id}"
                aria-label="Delete transaction">

                Delete

            </button>

        `;


        transactionList.appendChild(li);

    });

}


// Prevent HTML injection

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// Add transaction

form.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        const title =
            titleInput.value.trim();

        const amount =
            Number(amountInput.value);

        const type =
            typeInput.value;

        const category =
            categoryInput.value;


        if (!title || !Number.isFinite(amount) || amount <= 0) {

            alert(
                "Please enter valid transaction information."
            );

            return;
        }


        const transaction = {

            id: editingTransactionId === null
                ? Date.now()
                : editingTransactionId,

            title: title,

            amount: amount,

            type: type,

            category: category

        };


        // Preserve the original ID while editing so its creation date stays intact.
        const previousTransactions = transactions;

        if (editingTransactionId === null) {
            transactions = [...transactions, transaction];
        } else {
            const exists = transactions.some(
                item => item.id === editingTransactionId
            );

            if (!exists) {
                alert("This transaction no longer exists. Please try again.");
                resetTransactionForm();
                return;
            }

            transactions = transactions.map(item =>
                item.id === editingTransactionId ? transaction : item
            );
        }

        if (!saveTransactions()) {
            // Restore the previous list if browser storage rejects the change.
            transactions = previousTransactions;
            return;
        }

        calculateSummary();

        displayTransactions();


        resetTransactionForm();

    }
);


// Delete transaction with confirmation

transactionList.addEventListener(
    "click",
    function (event) {
        const actionButton = event.target.closest("button[data-id]");
        if (!actionButton) {
            return;
        }

        const id = Number(actionButton.dataset.id);
        const transactionToDelete = transactions.find(
            transaction => transaction.id === id
        );

        if (!transactionToDelete) {
            return;
        }

        if (actionButton.classList.contains("edit-btn")) {
            startEditingTransaction(transactionToDelete);
            return;
        }

        if (!actionButton.classList.contains("delete-btn")) {
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete "${transactionToDelete.title}"?`
        );

        if (!confirmed) {
            return;
        }


        const previousTransactions = transactions;

        transactions =
            transactions.filter(
                transaction =>
                    transaction.id !== id
            );

        if (!saveTransactions()) {
            // Keep the deleted item visible if storage could not be updated.
            transactions = previousTransactions;
            return;
        }

        lastDeletedTransaction = transactionToDelete;
        undoMessage.textContent = `Deleted "${transactionToDelete.title}".`;
        undoNotice.style.display = "flex";

        calculateSummary();

        displayTransactions();

    }
);


// Search

searchInput.addEventListener(
    "input",
    displayTransactions
);

// Keyboard shortcuts: press "/" to focus search and Escape to clear it.
document.addEventListener("keydown", function (event) {
    const target = event.target;
    const isTyping = target instanceof HTMLElement
        && (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInput.focus();
        return;
    }

    if (
        event.key === "Escape"
        && document.activeElement === searchInput
        && searchInput.value
    ) {
        searchInput.value = "";
        displayTransactions();
    }
});


// Filter

document
    .querySelectorAll(".filters .filter-btn[data-filter]")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                document
                    .querySelectorAll(".filters .filter-btn[data-filter]")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );


                this.classList.add("active");


                currentFilter =
                    this.dataset.filter;


                displayTransactions();

            }
        );

    });


// Export all transactions to a CSV file.

function escapeCsvCell(value) {

    let text = String(value ?? "");

    // Reduce the risk of spreadsheet formula injection.
    if (/^[=+@-]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

exportCsvButton.addEventListener("click", function () {

    if (transactions.length === 0) {
        alert("There are no transactions to export yet.");
        return;
    }

    // Each transaction ID is created with Date.now(), so it also records
    // the creation time. Export the exact timestamp in a stable UTC format.
    const headers = [
        "Created At (UTC)",
        "Description",
        "Amount (PKR)",
        "Type",
        "Category"
    ];
    const rows = transactions.map(transaction => [
        new Date(transaction.id).toISOString(),
        transaction.title,
        transaction.amount.toFixed(2),
        transaction.type,
        transaction.category
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(escapeCsvCell).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "expense-transactions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
});

// Initial application load

calculateSummary();

displayTransactions();
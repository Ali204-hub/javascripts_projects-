const STORAGE_KEY = "transactions";
const MONTHLY_BUDGET_KEY = "monthlyExpenseBudget";

function loadMonthlyBudget() {
    try {
        const storedBudget = localStorage.getItem(MONTHLY_BUDGET_KEY);
        if (storedBudget === null) {
            return null;
        }

        const budget = Number(storedBudget);
        return Number.isFinite(budget) && budget > 0 ? budget : null;
    } catch (error) {
        console.warn("Could not read the monthly budget.", error);
        return null;
    }
}

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
        && typeof transaction.category === "string"
        && (
            typeof transaction.notes === "undefined"
            || typeof transaction.notes === "string"
        );
}

let transactions = loadTransactions();
let monthlyBudget = loadMonthlyBudget();
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

const notesInput =
    document.getElementById("transactionNotes");

const transactionList =
    document.getElementById("transactionList");

const searchInput =
    document.getElementById("search");

const sortInput =
    document.getElementById("sortTransactions");

const fromDateInput = document.getElementById("fromDate");
const toDateInput = document.getElementById("toDate");
const clearDateRangeButton = document.getElementById("clearDateRangeBtn");
const dateRangeStatus = document.getElementById("dateRangeStatus");

const exportBackupButton = document.getElementById("exportBackupBtn");
const importBackupInput = document.getElementById("importBackupInput");
const backupStatus = document.getElementById("backupStatus");

const exportCsvButton =
    document.getElementById("exportCsvBtn");

const emptyMessage =
    document.getElementById("emptyMessage");

const monthlyExpenseTotal =
    document.getElementById("monthlyExpenseTotal");
const monthlyExpenseCount =
    document.getElementById("monthlyExpenseCount");
const topExpenseCategory =
    document.getElementById("topExpenseCategory");
const monthlyInsightMessage =
    document.getElementById("monthlyInsightMessage");
const categoryBreakdown =
    document.getElementById("categoryBreakdown");

const monthlyBudgetInput =
    document.getElementById("monthlyBudgetInput");
const saveMonthlyBudgetButton =
    document.getElementById("saveMonthlyBudgetBtn");
const monthlyBudgetProgress =
    document.getElementById("monthlyBudgetProgress");
const monthlyBudgetStatus =
    document.getElementById("monthlyBudgetStatus");

monthlyBudgetInput.value = monthlyBudget === null ? "" : String(monthlyBudget);

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

    renderMonthlyInsights();
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
    notesInput.value = transaction.notes || "";
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


// Summarize expense activity for the current calendar month.
function renderMonthlyInsights() {
    const now = new Date();
    const monthExpenses = transactions.filter(transaction => {
        if (transaction.type !== "expense") {
            return false;
        }

        const createdAt = new Date(transaction.id);
        return createdAt.getFullYear() === now.getFullYear()
            && createdAt.getMonth() === now.getMonth();
    });

    const total = monthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
    const categoryTotals = monthExpenses.reduce((totals, transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
        return totals;
    }, {});
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories[0];

    if (sortedCategories.length === 0) {
        categoryBreakdown.innerHTML =
            '<p class="category-breakdown-empty">No expense categories to display yet.</p>';
    } else {
        categoryBreakdown.innerHTML = sortedCategories.map(([category, amount]) => {
            const share = total > 0 ? (amount / total) * 100 : 0;
            const safeShare = Math.max(0, Math.min(100, share));

            return `
                <div class="category-breakdown-item">
                    <div class="category-breakdown-heading">
                        <span>${escapeHTML(category)}</span>
                        <strong>${formatRupees(amount)}</strong>
                    </div>
                    <div
                        class="category-breakdown-track"
                        role="progressbar"
                        aria-label="${escapeHTML(category)} share of monthly expenses"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${safeShare.toFixed(1)}"
                    >
                        <span style="width: ${safeShare.toFixed(2)}%"></span>
                    </div>
                    <small>${share.toFixed(1)}% of monthly expenses</small>
                </div>
            `;
        }).join("");
    }

    monthlyExpenseTotal.textContent = formatRupees(total);
    monthlyExpenseCount.textContent = String(monthExpenses.length);
    topExpenseCategory.textContent = topCategory
        ? `${topCategory[0]} — ${formatRupees(topCategory[1])}`
        : "No expenses yet";
    monthlyInsightMessage.textContent = monthExpenses.length
        ? `You recorded ${monthExpenses.length} expense transaction(s) this month.`
        : "Add an expense to start tracking this month's spending.";

    if (monthlyBudget === null) {
        monthlyBudgetProgress.value = 0;
        monthlyBudgetProgress.classList.remove("over-budget");
        monthlyBudgetStatus.textContent = "Set a monthly budget to see how much you have left to spend.";
        return;
    }

    const percentageUsed = (total / monthlyBudget) * 100;
    const remaining = monthlyBudget - total;

    monthlyBudgetProgress.value = Math.min(percentageUsed, 100);
    monthlyBudgetProgress.classList.toggle("over-budget", remaining < 0);

    monthlyBudgetStatus.textContent = remaining >= 0
        ? `${percentageUsed.toFixed(1)}% used — ${formatRupees(remaining)} remaining.`
        : `Budget exceeded by ${formatRupees(Math.abs(remaining))} (${percentageUsed.toFixed(1)}% used).`;
}


// Save the user's monthly spending limit separately from transaction data.
saveMonthlyBudgetButton.addEventListener("click", function () {
    const rawBudget = monthlyBudgetInput.value.trim();
    const budget = Number(rawBudget);

    if (!rawBudget || !Number.isFinite(budget) || budget <= 0) {
        monthlyBudgetStatus.textContent = "Enter a budget greater than zero.";
        monthlyBudgetInput.focus();
        return;
    }

    try {
        localStorage.setItem(MONTHLY_BUDGET_KEY, String(budget));
        monthlyBudget = budget;
        renderMonthlyInsights();
        monthlyBudgetStatus.textContent = `Budget saved. ${monthlyBudgetStatus.textContent}`;
    } catch (error) {
        console.error("Could not save the monthly budget.", error);
        monthlyBudgetStatus.textContent = "The budget could not be saved in this browser.";
    }
});


// Display transactions

function displayTransactions() {

    transactionList.innerHTML = "";

    const searchText =
        searchInput.value.toLowerCase().trim();

    // Let users search amounts with or without thousands separators/currency text.
    const normalizedSearch = searchText
        .replace(/rs\.?/g, "")
        .replace(/[\s,]/g, "");

    const startDate = fromDateInput.value
        ? new Date(`${fromDateInput.value}T00:00:00`)
        : null;
    const endDate = toDateInput.value
        ? new Date(`${toDateInput.value}T23:59:59.999`)
        : null;
    const hasDateFilter = Boolean(startDate || endDate);

    if (startDate && endDate && startDate > endDate) {
        dateRangeStatus.textContent = "Start date must be on or before the end date.";
        emptyMessage.textContent = "Please correct the selected date range.";
        emptyMessage.style.display = "block";
        return;
    }

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

            const createdAt = new Date(transaction.id);
            const matchesDateRange =
                (!startDate || createdAt >= startDate)
                && (!endDate || createdAt <= endDate);

            return matchesFilter && matchesSearch && matchesDateRange;

        })
        .sort((a, b) => {
            // IDs are created with Date.now(), so they also represent creation time.
            switch (sortInput.value) {
                case "oldest":
                    return a.id - b.id;
                case "amount-high":
                    return (b.amount - a.amount) || (b.id - a.id);
                case "amount-low":
                    return (a.amount - b.amount) || (b.id - a.id);
                case "newest":
                default:
                    return b.id - a.id;
            }
        });


    dateRangeStatus.textContent = hasDateFilter
        ? `Showing ${filteredTransactions.length} transaction(s) in the selected date range.`
        : "Filter transactions within a date range.";

    if (filteredTransactions.length === 0) {
        emptyMessage.textContent = hasDateFilter
            ? "No transactions found in this date range."
            : "No transactions found.";
        emptyMessage.style.display = "block";
        return;
    }

    emptyMessage.textContent = "No transactions found.";
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
        const notesMarkup = transaction.notes
            ? `<small class="transaction-notes">Note: ${escapeHTML(transaction.notes)}</small>`
            : "";


        li.innerHTML = `

            <div class="transaction-info">

                <h4>
                    ${escapeHTML(transaction.title)}
                </h4>

                <small>
                    ${escapeHTML(transaction.category)}
                </small>
                ${notesMarkup}
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
                class="filter-btn duplicate-btn"
                data-id="${transaction.id}"
                aria-label="Duplicate transaction">

                Duplicate

            </button>

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

            category: category,

            notes: notesInput.value.trim()

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

        renderMonthlyInsights();

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

        if (actionButton.classList.contains("duplicate-btn")) {
            // Prefill a new transaction without changing the original record.
            editingTransactionId = null;
            titleInput.value = `Copy of ${transactionToDelete.title}`;
            amountInput.value = transactionToDelete.amount;
            typeInput.value = transactionToDelete.type;
            categoryInput.value = transactionToDelete.category;
            notesInput.value = transactionToDelete.notes || "";
            formHeading.textContent = "Add Transaction";
            submitButton.textContent = "Add Transaction";
            cancelEditButton.hidden = true;
            form.scrollIntoView({ behavior: "smooth", block: "start" });
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

        renderMonthlyInsights();

        displayTransactions();

    }
);


// Search

searchInput.addEventListener(
    "input",
    displayTransactions
);

sortInput.addEventListener("change", displayTransactions);
fromDateInput.addEventListener("change", displayTransactions);
toDateInput.addEventListener("change", displayTransactions);

clearDateRangeButton.addEventListener("click", function () {
    fromDateInput.value = "";
    toDateInput.value = "";
    displayTransactions();
});

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


// Export transactions and the monthly budget as a versioned JSON backup.
function downloadBackup() {
    const backup = {
        format: "expense-tracker-pro-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        monthlyBudget,
        transactions
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json"
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = downloadUrl;
    link.download = `expense-tracker-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);

    backupStatus.textContent = `Backup downloaded with ${transactions.length} transaction(s).`;
}

function validateBackup(backup) {
    if (
        !backup
        || typeof backup !== "object"
        || backup.format !== "expense-tracker-pro-backup"
        || backup.version !== 1
    ) {
        throw new Error("This file is not a supported Expense Tracker Pro backup.");
    }

    if (!Array.isArray(backup.transactions)) {
        throw new Error("The backup does not contain a valid transactions list.");
    }

    const validTransactions = backup.transactions.every(transaction =>
        isValidTransaction(transaction)
        && transaction.title.trim().length > 0
        && transaction.category.trim().length > 0
    );

    if (!validTransactions) {
        throw new Error("The backup contains an invalid transaction record.");
    }

    const transactionIds = backup.transactions.map(transaction => transaction.id);
    if (new Set(transactionIds).size !== transactionIds.length) {
        throw new Error("The backup contains duplicate transaction IDs.");
    }

    const validBudget = backup.monthlyBudget === null
        || (
            typeof backup.monthlyBudget === "number"
            && Number.isFinite(backup.monthlyBudget)
            && backup.monthlyBudget > 0
        );

    if (!validBudget) {
        throw new Error("The backup contains an invalid monthly budget.");
    }

    return {
        transactions: backup.transactions,
        monthlyBudget: backup.monthlyBudget
    };
}

// Restore both localStorage values together. Roll back the first write if
// the second write fails, so an import does not leave a half-restored account.
function persistImportedBackup(imported) {
    const previousTransactions = localStorage.getItem(STORAGE_KEY);
    const previousBudget = localStorage.getItem(MONTHLY_BUDGET_KEY);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported.transactions));

        if (imported.monthlyBudget === null) {
            localStorage.removeItem(MONTHLY_BUDGET_KEY);
        } else {
            localStorage.setItem(MONTHLY_BUDGET_KEY, String(imported.monthlyBudget));
        }
    } catch (error) {
        try {
            if (previousTransactions === null) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, previousTransactions);
            }

            if (previousBudget === null) {
                localStorage.removeItem(MONTHLY_BUDGET_KEY);
            } else {
                localStorage.setItem(MONTHLY_BUDGET_KEY, previousBudget);
            }
        } catch (rollbackError) {
            console.error("Could not fully roll back a failed backup restore.", rollbackError);
        }

        throw error;
    }
}

exportBackupButton.addEventListener("click", downloadBackup);

importBackupInput.addEventListener("change", async function () {
    const file = importBackupInput.files[0];
    if (!file) {
        return;
    }

    try {
        if (file.size > 2 * 1024 * 1024) {
            throw new Error("Backup file is too large. Choose a file smaller than 2 MB.");
        }

        const backup = JSON.parse(await file.text());
        const imported = validateBackup(backup);
        const confirmed = window.confirm(
            `Restore ${imported.transactions.length} transaction(s) and the saved budget? ` +
            "This will replace the data currently saved in this browser."
        );

        if (!confirmed) {
            backupStatus.textContent = "Restore cancelled. Your saved data was not changed.";
            return;
        }

        persistImportedBackup(imported);
        transactions = imported.transactions;
        monthlyBudget = imported.monthlyBudget;
        monthlyBudgetInput.value = monthlyBudget === null ? "" : String(monthlyBudget);
        lastDeletedTransaction = null;
        undoNotice.style.display = "none";
        resetTransactionForm();

        calculateSummary();
        renderMonthlyInsights();
        displayTransactions();

        backupStatus.textContent = `Restore complete: ${transactions.length} transaction(s) loaded.`;
    } catch (error) {
        console.error("Could not restore the selected backup.", error);
        backupStatus.textContent = `Restore failed: ${error.message}`;
    } finally {
        importBackupInput.value = "";
    }
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

renderMonthlyInsights();

displayTransactions();
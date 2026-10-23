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


    const filteredTransactions =
        transactions.filter(transaction => {

            const matchesFilter =
                currentFilter === "all" ||
                transaction.type === currentFilter;

            // Search by description or category.
            const matchesSearch =
                transaction.title
                    .toLowerCase()
                    .includes(searchText) ||
                transaction.category
                    .toLowerCase()
                    .includes(searchText);

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


        li.innerHTML = `

            <div class="transaction-info">

                <h4>
                    ${escapeHTML(transaction.title)}
                </h4>

                <small>
                    ${escapeHTML(transaction.category)}
                </small>

            </div>


            <span class="transaction-amount">

                ${sign}
                ${formatRupees(transaction.amount)}

            </span>


            <button
                class="delete-btn"
                data-id="${transaction.id}">

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

            id: Date.now(),

            title: title,

            amount: amount,

            type: type,

            category: category

        };


        transactions.push(transaction);

        if (!saveTransactions()) {
            // Roll back the in-memory change when persistence fails.
            transactions.pop();
            return;
        }

        calculateSummary();

        displayTransactions();


        form.reset();

    }
);


// Delete transaction with confirmation

transactionList.addEventListener(
    "click",
    function (event) {

        if (
            !event.target.classList
                .contains("delete-btn")
        ) {
            return;
        }


        const id =
            Number(event.target.dataset.id);

        const transactionToDelete =
            transactions.find(
                transaction => transaction.id === id
            );

        if (!transactionToDelete) {
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

        calculateSummary();

        displayTransactions();

    }
);


// Search

searchInput.addEventListener(
    "input",
    displayTransactions
);


// Filter

document
    .querySelectorAll(".filter-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                document
                    .querySelectorAll(".filter-btn")
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
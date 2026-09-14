let transactions =
    JSON.parse(localStorage.getItem("transactions")) || [];

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

const emptyMessage =
    document.getElementById("emptyMessage");


// Save data

function saveTransactions() {

    localStorage.setItem(
        "transactions",
        JSON.stringify(transactions)
    );
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
        `Rs. ${income.toFixed(2)}`;

    document.getElementById("expense")
        .textContent =
        `Rs. ${expense.toFixed(2)}`;

    document.getElementById("balance")
        .textContent =
        `Rs. ${balance.toFixed(2)}`;
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

            const matchesSearch =
                transaction.title
                    .toLowerCase()
                    .includes(searchText);

            return matchesFilter && matchesSearch;

        });


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
                Rs. ${transaction.amount.toFixed(2)}

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


        if (!title || amount <= 0) {

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


        saveTransactions();

        calculateSummary();

        displayTransactions();


        form.reset();

    }
);


// Delete transaction

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


        transactions =
            transactions.filter(
                transaction =>
                    transaction.id !== id
            );


        saveTransactions();

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


// Initial application load

calculateSummary();

displayTransactions();
-- The account of each customer, opened on first use, and the transfers sent from it.
CREATE TABLE account (
    customer VARCHAR(255) PRIMARY KEY,
    balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0)
);

CREATE TABLE transfer (
    id UUID PRIMARY KEY,
    customer VARCHAR(255) NOT NULL REFERENCES account (customer),
    iban VARCHAR(34) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

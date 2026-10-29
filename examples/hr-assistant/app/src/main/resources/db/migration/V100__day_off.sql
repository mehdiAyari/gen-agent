-- The days off booked by each employee, one row per day.
CREATE TABLE day_off (
    employee VARCHAR(255) NOT NULL,
    day DATE NOT NULL,
    booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (employee, day)
);

import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "books_review",
  password: "Josr84#",
  port: 5432
})

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function selectAllBooks() {
  const result = await db.query(`SELECT books.*, rates.rate_digit FROM books LEFT JOIN rates
    ON rates.book_id = books.book_id`);
  const books = result.rows;
  return books;
}

app.get("/", async (req, res) => {
  const books = await selectAllBooks();
  res.render("index.ejs",
    {
      books,
      kindOfSort: null,
      genre: null,
    });
});

app.get("/sort/:kindOfSort", async (req, res, next) => {
  const kindOfSort = req.params.kindOfSort;
  if (kindOfSort === 'oceną') {
    try {
      const result = await db.query(`
        SELECT b.*, r.rate_digit
          FROM books AS b
          JOIN rates AS r
            ON b.book_id = r.book_id
        ORDER BY r.rate_digit DESC
      `);
      const books = result.rows;
      return res.render("index.ejs", {
        books,
        kindOfSort
      });
    } catch (err) {
      return next(err);
    }
  }
  if (kindOfSort === 'tytułem') {
    try {
      const result = await db.query(`SELECT * FROM books ORDER BY title ASC`)
      const books = result.rows;
      res.render("index.ejs", {
        books,
        kindOfSort
      })
    } catch (err) {
      return next(err);
    }
  }
});

app.get("/sort/:kindOfSort/:genre", async (req, res) => {
  const selectedKindOfSort = req.params.kindOfSort;
  const selectedOptionGenre = req.params.genre;
  if (selectedKindOfSort === "gatunkiem") {
    const result = await db.query(`SELECT * FROM books WHERE
        genre LIKE $1`, [`%${selectedOptionGenre}`]);
    const books = result.rows;
    res.render("index.ejs", {
      books,
      kindOfSort: selectedKindOfSort,
      genre: selectedOptionGenre
    })
  }
})

app.post("/add-new-book", async (req, res) => {
  res.redirect("/new");
})

app.get("/new", (req, res) => {
  res.render("new.ejs", {
    title: "",
    author: "",
    genre: "",
    isbn: "",
    rating: "",
    notes: "",
    errors: {}
  })
})

app.post("/new", async (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const genre = req.body.genre;
  const isbn = req.body.isbn;
  const rating = req.body.rating;
  const notes = req.body.notes;

  const errors = {};

  if (!title) errors.title = "To pole jest wymagane.";
  if (!author) errors.author = "To pole jest wymagane.";
  if (!genre) errors.genre = "To pole jest wymagane.";
  if (!isbn) errors.isbn = "To pole jest wymagane.";
  if (!rating) errors.rating = "To pole jest wymagane.";
  if (!notes) errors.notes = "To pole jest wymagane.";

  if (title.length !== 0 && author.length !== 0 && genre.length !== 0 && isbn.length !== 0
    && rating.length !== 0 && notes.length !== 0) {
    const resultBook = await db.query(`INSERT INTO books (title, author, genre, isbn) 
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, author, genre, isbn]);
    console.log("The book added to DB for books table:", resultBook.rows[0]);

    const bookId = resultBook.rows[0].book_id;

    const date = new Date();
    const resultRating = await db.query(`INSERT INTO rates (rate_description, book_id, date_rating)
      VALUES ($1, $2, $3) RETURNING *`, [rating, bookId, date]);
    console.log("The rating description added to DB for rates table:", resultRating.rows[0]);


    const resultNotes = await db.query(`INSERT INTO notes (content_note, book_id)
      VALUES ($1, $2) RETURNING *`, [notes, bookId]);
    console.log("The notes added to DB for books table:", resultNotes.rows[0]);

    return res.render("new.ejs", {
      title, author, genre, isbn, rating, notes, date, errors: {}
    })
  } else {
    return res.render("new.ejs", {
      errors, title, author, genre, isbn, rating, notes, date
    })
  }
})

app.post("/search", async (req, res) => {
  try {
    const searchedPhrase = req.body.search;
    const searchTerm = `%${searchedPhrase.toLowerCase()}%`;
    const result = await db.query(`SELECT * FROM books WHERE
    LOWER(title) LIKE $1 OR LOWER(author) LIKE $1`, [searchTerm]);
    const books = result.rows;
    if (books.length === 0) {
      const error = "Brak książek odpowiadających szukanej frazie.";
      res.render("index.ejs", { books, error: error });
      return;
    }
    res.render("index.ejs", { books, error: "" })
  } catch (err) {
    console.log(err);
    res.status(500).send("Błąd pobierania danych.");
  }
});

app.post("/submitRating", async (req, res) => {
  try {
    const bookId = req.body.bookId;
    const stars = parseInt(req.body.rating);

    await db.query(
      `UPDATE rates
       SET rate_digit = ($1)
       WHERE book_id   = ($2);`,
      [stars, bookId]
    );

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Błąd zapisu oceny.");
  }
});

app.get("/details/:selectedBookId", async (req, res) => {
  const allBooks = await selectAllBooks();
  const selectedBookId = req.params.selectedBookId;
  const result = await db.query(`SELECT *
      FROM books
      WHERE books.book_id = $1`,
    [selectedBookId]);
  const book = result.rows[0];
  if (result.rows.length === 0) {
    return res.status(404).send("Nie znaleziono książki.");
  }
  const notesResult = await db.query(`SELECT content_note 
      FROM notes 
      WHERE book_id = $1`, [selectedBookId]);
  const note = notesResult.rows[0]?.content_note || "";
  const resultRates = await db.query(`SELECT * FROM rates WHERE book_id = $1`, [selectedBookId]);
  const rates = resultRates.rows;

  res.render("details.ejs", { book, allBooks, note, rates });
})

app.post("/editRating", async (req, res) => {
  const bookId = req.body.bookId;
  const updatedRatingId = req.body.rate_id;
  const rateDescription = req.body.rateDescription;
  const date = new Date();
  await db.query(`UPDATE rates
      SET rate_description = $2, date_rating = $3
      WHERE rate_id = $1`,
    [updatedRatingId, rateDescription, date]
  );
  res.redirect(`/details/${bookId}`);
})

app.post("/deleteRating", async (req, res) => {
  const bookId = req.body.bookId;
  const deletingRateId = req.body.rate_id;

  try {
    await db.query(`DELETE FROM rates WHERE rate_id = $1`, [deletingRateId]);

    res.redirect(`/details/${bookId}`);
  } catch (error) {
    console.error("Mistake while rate deleting:", error);
    res.status(500).send("Wystąpił błąd podczas usuwania oceny.");
  }
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

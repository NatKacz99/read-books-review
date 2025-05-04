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
  const result = await db.query("SELECT * FROM books");
  const books = result.rows;
  return books;
}

app.get("/", async (req, res) => {
  const books = await selectAllBooks();
  res.render("index.ejs", 
    { books,
      kindOfSort: null,
      genre: null
     });
});

app.get("/sort/:kindOfSort", async (req, res) => {
  const selectedKindOfSort = req.params.kindOfSort;
  if(selectedKindOfSort === "tytułem"){
    const result = await db.query(`SELECT * FROM books ORDER BY title ASC`)
    const books = result.rows;
    res.render("index.ejs", { 
      books,
      kindOfSort: selectedKindOfSort
    })
  }
})

app.get("/sort/:kindOfSort/:genre", async (req, res) => {
  const selectedKindOfSort = req.params.kindOfSort;
  const selectedOptionGenre = req.params.genre;
  if(selectedKindOfSort === "gatunkiem"){
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
    res.status(500).send("Error retrieving data.");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const pool = require('../config/database.js')

const insertReview = async (req, res, next) => {
  if(!req.body) {
    res.status(400).json({ error: 'body puuttuu'})
  } else {
    const tmdbId = req.body.id
    const reviewText = req.body.review
    const reviewRating = req.body.rating

    if(!tmdbId || !reviewText || !reviewRating) {
      return res.status(400).json({ error: 'Jokin puuttuu'})
    } else {
      try {
        const movieResult = await pool.query('SELECT movie_id FROM movies WHERE tmdb_id=$1;', [tmdbId])
        if(movieResult.rows.length === 0) {
          return res.status(404).json('Elokuvaa ei löydy')
        } else {
          const movieId = movieResult.rows[0].movie_id
          const insertResult = await pool.query(
            'INSERT INTO reviews (user_id, movie_id, review_text, rating) '
            +'VALUES ($1, $2, $3, $4) '
            +'RETURNING review_id;',
            [req.userId, movieId, reviewText, reviewRating]
          )
          if(insertResult.rowCount === 1) {
            return res.status(201).json({ id: insertResult.rows[0].review_id })
          }
        }
      } catch(err) {
        return next(err)
      }
    }
  }
}

const selectReview = async (req, res, next) => {
  const reviewId = req.params.id
  if(!reviewId) {
    return res.status(400).json({ error: "id puuttuu" })
  } else {
    try {
      const reviewResult = await pool.query(
        'SELECT review_id, review_text, rating, reviews.created_at, tmdb_id, title, poster_url, release_year'
        +' FROM reviews INNER JOIN movies ON reviews.movie_id=movies.movie_id'
        +' WHERE review_id=$1;',
        [reviewId]
      )
      if(reviewResult.rows.length === 0) {
        return res.status(404).json("Arvostelua ei löydy")
      } else {
        return res.status(200).json(reviewResult.rows[0])
      }
    } catch(err) {
      return next(err)
    }
  }
}

const selectReviewsForMainPage = async (req, res, next) => {
  try {
    result = await pool.query(
      'SELECT review_id, review_text, rating, reviews.created_at, tmdb_id, title, poster_url, release_year'
      +' FROM reviews INNER JOIN movies ON reviews.movie_id=movies.movie_id'
      +' ORDER BY reviews.created_at DESC LIMIT 30;'
    )
    res.status(200).json(result.rows)
  } catch(err) {
    return next(err)
  }
}

module.exports = { insertReview, selectReview, selectReviewsForMainPage }
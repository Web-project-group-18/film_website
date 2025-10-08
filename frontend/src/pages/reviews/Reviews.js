import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import authService from "../../services/api"
import MovieCard from "../../components/MovieCard"
import { Review } from "../../components/reviewComponents"
import "./Reviews.css"

const Reviews = () => {
  const [loggedIn, setLoggedIn] = useState(false)
  const [reviews, setReviews] = useState([])

  const reviewsFetched = useRef(false)

  useEffect(() => {
    document.body.classList.add('reviews-page');
    return () => {
      document.body.classList.remove('reviews-page');
    };
  }, []);

  useEffect(() => {
    const apiUrl = "http://localhost:3001/api/"

    setLoggedIn(authService.isAuthenticated)

    const getReviews = async (setReviewsCallback) => {
      if(!reviewsFetched.current) {
        reviewsFetched.current = true
        const response = await fetch(apiUrl+"reviews")
        const result = await response.json()
        setReviewsCallback(result)
      }
    }

    getReviews(setReviews)
  }, [loggedIn, reviewsFetched, setReviews])

  return(
    <div className="container" id="reviews-list-container">
      <h2>Arvostelut</h2>
      <div id="recent-reviews">
        {reviews.map((item) => (
          <Link key={item.review_id} to={"/reviews/"+item.review_id}>
            <div className="single-review">
              <MovieCard
                title={item.title}
                image={item.poster_url}
                year={item.release_year}
              />
              <Review text={item.review_text} rating={item.rating} />
          </div>
          </Link>
        ))}
      </div>
      { loggedIn ? <ReviewButton /> : null }
    </div>
  )
}

const ReviewButton = () => (
  <div id="review-button">
    <Link to="/reviews/write">
      <button id="review-button">
        Kirjoita arvostelu
      </button>
    </Link>
  </div>
)

export default Reviews
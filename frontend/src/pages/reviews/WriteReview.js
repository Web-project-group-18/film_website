import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './WriteReview.css'
import MovieCard from '../../components/MovieCard.js'

const WriteReview = () => {
  const [text, setText] = useState("")
  const [rating, setRating] = useState(0)
  const [clicked, setClicked] = useState(false)
  const [error, setError] = useState("")
  const [movie, setMovie] = useState({})

  const movieFetched = useRef(false)

  const params = useParams()
  const movieId = params.id

  const navigate = useNavigate()

  let sequence = []
  for(let i = 1; i <= 10; i++) {
    sequence.push(i)
  }
  const apiUrl = "http://localhost:3001/api/"

  useEffect(() => {
    if(!movieFetched.current) {
      const getMovie = async (setMovieCallback) => {
        const response = await fetch(
          apiUrl+"movies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: movieId })
          }
        )
        if(response.status === 201 || response.status === 200) {
          setMovieCallback(await response.json());
          movieFetched.current = true;
        }
      }
      getMovie(setMovie);
    }
  }, [apiUrl, movieId, setMovie, setError])

  useEffect(() => {
    const handleReviewPost = async () => {
      if(text && (rating > 0)) {
        const response = await fetch(
          apiUrl+"reviews", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer "+localStorage.getItem('token')
              },
            body: JSON.stringify({ id: movieId, review: text, rating: rating })
          }
        )
        const result = await response.json()
        if(response.status === 201) {
          const link = "/reviews/"+result.id
          navigate(link)
        } else if(response.status === 403) {
          setError("Istuntosi on vanhentunut")
        } else {
          setError("Arvostelun lähettämisessä tapahtui virhe")
        }
      } else {
        if(text) {
          setError("Arvosana puuttuu")
        } else if(rating > 0) {
          setError("Arvostelu puuttuu")
        } else {
          setError("Arvostelu ja arvosana puuttuvat")
        }
      }
    }

    if(clicked === true) {
      handleReviewPost()
      setClicked(false)
    }
  }, [clicked, rating, text, apiUrl, movieId, navigate])

  const onText = (event) => {
    setText(event.target.value.trim())
    event.target.style.height = "auto"
    event.target.style.height ="calc("+event.target.scrollHeight+"px + "
      + getComputedStyle(event.target).getPropertyValue("padding-left")+")"
    // event.target.style.height = event.target.scrollHeight+"px"
  }

  const onPost = () => {
    setClicked(true)
  }

  const onRating = (event) => {
    setRating(parseInt(event.target.value))
  }

  return(
    <div className="container">
      <h2 className="page-name">Kirjoita arvostelu</h2>
      <div id="review-view">
        <MovieCard title={movie.title} image={movie.poster_url} year={movie.release_year}/>
        <div id="review-inputs">
          <textarea placeholder="Kirjoita arvostelu tähän" maxLength={10000} onChange={onText}/>
          <div className="error-rating-post">
            <h3>{error}</h3>
            <div className="rating">
              {sequence.map((i) => {
                return(
                  <div className="review-button">
                    <input key={i} id={"radio"+i} type="radio" name="rating" value={i} onChange={onRating}/>
                    <label for={"radio"+i}>{i}</label>
                  </div>
                )
              })}
            </div>
            <button className="post" onClick={onPost}>Lähetä arvostelu</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WriteReview
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SearchFilmToReview.css'
import MovieCard from '../../components/MovieCard.js'
import axios from 'axios' // Import axios

const SearchFilmToReview = () => {
  const navigate = useNavigate()

  const [query, setQuery] = useState("")
  const [movies, setMovies] = useState([])
  const [searched, setSearched] = useState(false)

  const onText = (event) => {
    setQuery(event.target.value)
  }

  const onSearch = async (event) => {
    event.preventDefault()
    setSearched(true)

    try {
      const apiKey = process.env.REACT_APP_TMDB_KEY;
      let endpoint = "";

      if (query) {
        // If the user enters a name, use search/movie
        endpoint = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=fi-FI&query=${encodeURIComponent(
          query
        )}`;
      } else {
        // If no name -> use discover/movie
        endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fi-FI`;
      }

      const res = await axios.get(endpoint);
      if (res.data && res.data.results) {
        setMovies(res.data.results);
      } else {
        setMovies([]);
      }
    } catch (err) {
      console.error("Error in TMDB search:", err);
      setMovies([]);
    }
  }

  const onChoose = (id) => {
    navigate('/reviews/write/'+id)
  }
  
  return(
    <div className="container" id="review-search-container">
      <h2>Valitse elokuva, josta haluat kirjoittaa arvostelun</h2>
      <div id="search-to-review">
        <form onSubmit={onSearch}>
          <input type="text" value={query} onChange={onText} />
          <button type="submit">Hae</button>
        </form>
        <div id="review-search-list">
          {searched && movies.length === 0 && <p>Ei hakutuloksia.</p>}
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              title={movie.title}
              image={process.env.REACT_APP_IMG_BASE_URL+movie.poster_path}
              year={movie.release_date ? movie.release_date.slice(0, 4) : ''}
              onClick={() => onChoose(movie.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default SearchFilmToReview
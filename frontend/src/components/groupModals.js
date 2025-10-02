import { useEffect, useState, useRef } from 'react'
import '../styles/groupModals.css'
import MovieCard from './MovieCard'

const apiUrl = 'http://localhost:3001/api/groups/'

const GroupForm = ({ handleSubmit }) => {
  const [groups, setGroups] = useState([])
  const fetchStarted = useRef(false)

  useEffect(() => {
    const fetchGroups = async () => {
      const response = await fetch(apiUrl+'my-groups', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer "+localStorage.getItem('token')
        }
      })
      if(response.status === 200) {
        const result = await response.json()
        setGroups(result.groups)
        console.log(result.groups)
      }
    }
    if(fetchStarted.current === false) {
      fetchStarted.current = true
      fetchGroups()
    }
  }, [setGroups])

  return(
    <form method="post" onSubmit={handleSubmit}>
      <label>
        Valitse ryhmä
        {groups.map((g) =>
          <option key={g.group_id}>{g.group_name}</option>
        )}
      </label>
      <button type="submit">
        Lisää ryhmään
      </button>
    </form>
  )
}

const AddMovieToGroup = ({ onClose, tmdbMovie }) => {
  const addMovieToGroup = (event) => {
    event.preventDefault()
    const form = event.target
    const formData = new FormData(form)
  }
  return(
    <div className="group-modal-bg">
      <div className="group-modal" id="group-movie-modal">
        <MovieCard
          title={tmdbMovie.title}
          image={'https://image.tmdb.org/t/p/w185'+tmdbMovie.poster_path}
          year={tmdbMovie.release_date.slice(0, 4)}
        />
        <GroupForm handleSubmit={addMovieToGroup} />
        <button onClick={onClose}>Palaa elokuvahakuun</button>
      </div>
    </div>
  )
}

const AddShowtimeToGroup = () => {
  
}

export { AddMovieToGroup }
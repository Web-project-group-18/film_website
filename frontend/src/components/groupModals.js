import { useEffect, useState, useRef } from 'react'
import '../styles/groupModals.css'
import MovieCard from './MovieCard'

const apiUrl = 'http://localhost:3001/api/groups/'

const GroupForm = ({ handleSubmit }) => {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState({})
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

  const handleChange = (e) => {
    setSelectedGroup(e.target.value)
  }

  return(
    <form id="group-submitter" method="post" onSubmit={handleSubmit}>
      <h4>Valitse ryhmä</h4>
      <div id="group-radio">
        {groups.map((g) => (
            <label className="group-select-button">
              <input
                key={g.group_id}
                type="radio"
                name="group"
                value={g.group_id}
                onChange={handleChange}
              />
              <h5>{g.group_name}</h5>
            </label>
          )
        )}
      </div>
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
    <div className="group-modal" id="group-movie-modal">
      <MovieCard
        title={tmdbMovie.title}
        image={'https://image.tmdb.org/t/p/w185'+tmdbMovie.poster_path}
        year={tmdbMovie.release_date.slice(0, 4)}
      />
      <GroupForm handleSubmit={addMovieToGroup} />
      <button onClick={onClose}>Peruuta</button>
    </div>
  )
}

const AddShowtimeToGroup = () => {
  
}

export { AddMovieToGroup }
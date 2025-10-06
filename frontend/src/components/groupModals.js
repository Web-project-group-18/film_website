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
      }
    }
    if(!fetchStarted.current) {
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
            <label key={g.group_id} className="group-select-button">
              <input
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
  const [status, setStatus] = useState(0)
  const [body, setBody] = useState({})
  const fetchStarted = useRef(false)

  const addMovieToGroup = async (e, movieId) => {
    e.preventDefault()
    if(!fetchStarted.current) {
      fetchStarted.current = true

      const form = e.target
      const formData = new FormData(form)
      const groupId = formData.get('group')
      
      const response = await fetch(
        apiUrl+groupId+'/movies', {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer "+localStorage.getItem('token')
            },
          body: JSON.stringify({ tmdb_id: movieId })
        }
      )
      const result = await response.json()
      setBody(result)
      const s = response.status
      setStatus(s)
      fetchStarted.current = false
    }
  }
  return(
    <div className="group-modal" id="group-movie-modal">
      <MovieCard
        title={tmdbMovie.title}
        image={'https://image.tmdb.org/t/p/w185'+tmdbMovie.poster_path}
        year={tmdbMovie.release_date.slice(0, 4)}
      />
      <GroupForm handleSubmit={(e) => addMovieToGroup(e, tmdbMovie.id)} />
      {(status >= 100) && (
        <h3>
          {((status === 201) || (status === 200)) ? body.message : "Elokuvan lisäämisessä ryhmään tapahtui virhe"}
        </h3>
      )}
      <button onClick={onClose}>Peruuta</button>
    </div>
  )
}

const AddShowtimeToGroup = () => {
  
}

export { AddMovieToGroup }
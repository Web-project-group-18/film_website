import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom"
import axios from "axios";
import "../styles/Search.css";
import { addMovieToList, getFavoriteLists } from "../services/favoritesService";
import { AddMovieToGroup } from "./groupModals";

const GENRES = [
  { id: 28, name: "Toiminta" },
  { id: 18, name: "Draama" },
  { id: 35, name: "Komedia" },
  { id: 27, name: "Kauhu" },
  { id: 878, name: "Scifi" },
];

const YEARS = ["2025", "2024", "2023", "2022", "2021"];

export default function Search() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedList, setSelectedList] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [movieToAdd, setMovieToAdd] = useState(null);

  const isLoggedIn = !!localStorage.getItem("token");

  useEffect(() => {
    if (isLoggedIn) {
      getFavoriteLists()
        .then((res) => {
          const lists = res.data || [];
          setFavoriteLists(lists);
          if (lists.length > 0) {
            setSelectedList(lists[0].list_id.toString());
          }
        })
        .catch((err) => {
          console.error("Virhe suosikkilistojen haussa:", err);
        });
    }
  }, [isLoggedIn]);

  const handleAddFavorite = (movie) => {
    setMovieToAdd(movie);
    setShowModal(true);
  };

  const openGroupModal = (movie) => {
    setMovieToAdd(movie)
    setShowGroupModal(true)
  }

  const handleConfirmAddFavorite = async () => {
    try {
      if (!selectedList) {
        alert("Valitse suosikkilista ennen lisäämistä.");
        return;
      }
      const listId = parseInt(selectedList, 10);

      await addMovieToList(listId, {
        tmdb_id: movieToAdd.id,
        title: movieToAdd.title,
        poster_url: `https://image.tmdb.org/t/p/w200${movieToAdd.poster_path}`,
        release_year: movieToAdd.release_date?.slice(0, 4),
        tmdb_rating: movieToAdd.vote_average,
      });

      alert(`${movieToAdd.title} lisättiin suosikkeihin!`);
      setShowModal(false);
      setMovieToAdd(null);
    } catch (err) {
      console.error("Suosikkiin lisäys epäonnistui:", err);
      alert("Virhe lisättäessä suosikkiin");
    }
  };

  //TMDB Haku
  const handleSearch = async () => {
    setLoading(true);

    try {
      const apiKey = process.env.REACT_APP_TMDB_KEY;
      let endpoint = "";

      if (query) {
        // Jos käyttäjä kirjoittaa nimen, käytetään search/movie
        endpoint = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=fi-FI&query=${encodeURIComponent(
          query
        )}`;
        if (year) {
          endpoint += `&year=${year}`;
        }
        // HUOM: with_genres ei toimi searchissa
      } else {
        // Jos ei nimeä -> käytetään discover/movie
        endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fi-FI`;
        if (genre) {
          endpoint += `&with_genres=${genre}`;
        }
        if (year) {
          endpoint += `&primary_release_year=${year}`;
        }
      }

      const res = await axios.get(endpoint);
      if (res.data && res.data.results) {
        setResults(res.data.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Virhe TMDB-haussa:", err);
    } finally {
      setLoading(false);
    }
  };

  //UI
  return (
    <div className="search-container" id="search">
      <h2>🎬 Elokuvahaku</h2>

      <div className="search-row">
        <input
          type="text"
          placeholder="Kirjoita nimi..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />

        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Valitse genre</option>
          {GENRES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Valitse vuosi</option>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>

        <button onClick={handleSearch}>Hae</button>
      </div>

      {loading && <p>Ladataan…</p>}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Valitse suosikkilista</h3>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
            >
              {favoriteLists.map((list) => (
                <option key={list.list_id} value={list.list_id}>
                  {list.list_name}
                </option>
              ))}
            </select>
            <div className="modal-buttons">
              <button
                className="confirm-btn"
                onClick={handleConfirmAddFavorite}
              >Vahvista</button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowModal(false);
                  setMovieToAdd(null);
                }}
              >Peruuta</button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal && createPortal(
        <AddMovieToGroup onClose={() => setShowGroupModal(false)} tmdbMovie={movieToAdd}/>,
        document.body
      )}

      <div className="results-grid">
        {results.map((m) => (
          <div key={m.id} className="result-card">
            {m.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w200${m.poster_path}`}
                alt={m.title}
              />
            ) : (
              <div className="poster-placeholder">Ei kuvaa</div>
            )}
            <h4>{m.title}</h4>
            <p>
              {m.release_date?.slice(0, 4) || "N/A"} •{" "}
              {m.vote_average
                ? m.vote_average.toFixed(1) + "/10"
                : "Ei arvosanaa"}
            </p>
            {isLoggedIn && (
              <div className="result-buttons">
                <button
                  className="favorite-btn"
                  onClick={() => handleAddFavorite(m)}>
                  ⭐ Lisää suosikkeihin
                </button>
                <button className="add-movie-to-group" onClick={() => openGroupModal(m)}>
                  Lisää ryhmään
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

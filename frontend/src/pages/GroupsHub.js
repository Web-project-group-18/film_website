import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import GroupService from "../services/groupService";
/*import "../styles/GroupsHub.css";*/


export default function GroupsHub() {
  const [loading, setLoading] = useState(false);

  // listat
  const [myGroups, setMyGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allSearch, setAllSearch] = useState("");

  // valinta + tarkempi data
  const [selectedId, setSelectedId] = useState(null);
  const [group, setGroup] = useState(null);     // res.data.group
  const [members, setMembers] = useState([]);   // res.data.members
  const [requests, setRequests] = useState([]); // listJoinRequests (owner)

  // lomakekentät
  const inviteRef = useRef(null);               // kutsu/add member
  const [newGroupName, setNewGroupName] = useState("");

  // viestit
  const [message, setMessage] = useState(null);
  const clearRef = useRef();
  const ok  = (t) => setMessage({ type: "ok",  text: t });
  const err = (t) => setMessage({ type: "err", text: t });
  const clearMsgLater = () => {
    clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setMessage(null), 2500);
  };
  useEffect(() => () => clearTimeout(clearRef.current), []);

  const role = useMemo(() => (group ? group._userRole : null), [group]);

  // elokuvat
  const apiUrl = 'http://localhost:3001/api/groups/'
  const [showMovies, setShowMovies] = useState(false)
  const moviesLoading = useRef(false)
  useEffect(() => {
    const fetchMovies = async () => {
      const response = await fetch(apiUrl+selectedId+'/movies', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer "+localStorage.getItem('token')
        }
      })
      const result = await response.json()
      console.log(result)
    }
    if(!moviesLoading.current && showMovies) {
      moviesLoading.current = true
      fetchMovies()
    }
  }, [moviesLoading, showMovies])

  const toggleMovies = () => {
    if(showMovies) {
      setShowMovies(false)
      moviesLoading.current = false
    } else {
      setShowMovies(true)
    }
  }

  /* -------------------- lataukset -------------------- */
  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await GroupService.getMyGroups();
      const all  = await GroupService.getAllGroups();

      setMyGroups(mine.data.groups || []);
      setAllGroups(all.data.groups || []);

      // Valitse ensimmäinen oma ryhmä, jos ei vielä valittua
      const firstId = mine.data.groups?.[0]?.group_id ?? null;
      setSelectedId((prev) => (prev ?? firstId));
    } catch (e) {
      err(e?.response?.data?.error || "Ryhmien haku epäonnistui");
      clearMsgLater();
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGroup = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await GroupService.getGroup(id); // { group, members, userRole }
      const g = res.data.group;
      g._userRole = res.data.userRole;
      setGroup(g);
      setMembers(res.data.members || []);
      if (res.data.userRole === "owner") {
        const r = await GroupService.listJoinRequests(id);
        setRequests(r.data.requests || []);
      } else {
        setRequests([]);
      }
    } catch {
      // esim. 403 jos ei jäsen -> sallittu tila
      setGroup(null);
      setMembers([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { if (selectedId) loadGroup(selectedId); }, [selectedId, loadGroup]);

  /* -------------------- toiminnot -------------------- */
  const handleRefresh = async () => {
    await loadLists();
    if (selectedId) await loadGroup(selectedId);
  };

  const handleCreateGroup = async () => {
    const name = (newGroupName || "").trim();
    if (!name) { err("Ryhmän nimi puuttuu"); clearMsgLater(); return; }
    try {
      await GroupService.createGroup(name);
      setNewGroupName("");
      ok("Ryhmä luotu");
      clearMsgLater();
      await loadLists();
    } catch (e) {
      err(e?.response?.data?.error || "Ryhmän luonti epäonnistui");
      clearMsgLater();
    }
  };

  const requestJoin = async (id) => {
    try {
      await GroupService.requestJoin(id);
      ok("Liittymispyyntö lähetetty");
      clearMsgLater();
      if (selectedId === id) await loadGroup(id);
    } catch (e) {
      err(e?.response?.data?.error || "Liittymispyyntö epäonnistui");
      clearMsgLater();
    }
  };

  const addMember = async () => {
    const em = (inviteRef.current?.value || "").trim();
    if (!em) { err("Sähköposti puuttuu"); clearMsgLater(); return; }
    try {
      await GroupService.addMember(selectedId, em);
      if (inviteRef.current) inviteRef.current.value = "";
      ok("Kutsu lähetetty / jäsen lisätty");
      clearMsgLater();
      await loadGroup(selectedId);
    } catch (e) {
      err(e?.response?.data?.error || "Kutsu/Lisäys epäonnistui");
      clearMsgLater();
    }
  };

  const removeMember = async (em) => {
    try {
      await GroupService.removeMember(selectedId, em);
      ok("Jäsen poistettu");
      clearMsgLater();
      await loadGroup(selectedId);
    } catch (e) {
      err(e?.response?.data?.error || "Poisto epäonnistui");
      clearMsgLater();
    }
  };

  const approveJoin = async (em) => {
    try {
      await GroupService.approveJoin(selectedId, em);
      ok("Pyyntö hyväksytty");
      clearMsgLater();
      await loadGroup(selectedId);
    } catch (e) {
      err(e?.response?.data?.error || "Hyväksyntä epäonnistui");
      clearMsgLater();
    }
  };

  const rejectJoin = async (em) => {
    try {
      await GroupService.rejectJoin(selectedId, em);
      ok("Pyyntö hylätty");
      clearMsgLater();
      await loadGroup(selectedId);
    } catch (e) {
      err(e?.response?.data?.error || "Hylkäys epäonnistui");
      clearMsgLater();
    }
  };

  const leaveGroup = async () => {
    try {
      await GroupService.leaveGroup(selectedId);
      ok("Poistuit ryhmästä");
      clearMsgLater();
      await loadLists();
      setSelectedId(null);
      setGroup(null);
      setMembers([]);
      setRequests([]);
    } catch (e) {
      err(e?.response?.data?.error || "Poistuminen epäonnistui");
      clearMsgLater();
    }
  };

  const deleteGroup = async () => {
    if (!window.confirm("Poistetaanko ryhmä pysyvästi?")) return;
    try {
      await GroupService.deleteGroup(selectedId);
      ok("Ryhmä poistettu");
      clearMsgLater();
      await loadLists();
      setSelectedId(null);
      setGroup(null);
      setMembers([]);
      setRequests([]);
    } catch (e) {
      err(e?.response?.data?.error || "Ryhmä poistaminen epäonnistui");
      clearMsgLater();
    }
  };

  /* -------------------- UI helpers -------------------- */
  const Pill = ({ children }) => (
    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, background: "var(--color-surface)" }}>
      {children}
    </span>
  );

  const Panel = ({ title, children, footer }) => (
    <div style={{ background: "var(--color-surface)", padding: 16, borderRadius: 8 }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>}
      {children}
      {footer}
    </div>
  );

  const filteredAll = allGroups.filter((g) =>
    allSearch ? g.group_name.toLowerCase().includes(allSearch.toLowerCase()) : true
  );

  /* -------------------- render -------------------- */
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      {/* yläpalkki + palauteviestit */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Ryhmät</h1>

        {/* Luo ryhmä */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Uuden ryhmän nimi"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            autoComplete="off"
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button type="button" onClick={handleCreateGroup} style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            Luo ryhmä
          </button>
          <button type="button" onClick={handleRefresh} style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            Päivitä
          </button>
        </div>

        {message && (
          <div
            role="status"
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              marginTop: 8,
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Omat & kaikki ryhmät */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Omat ryhmät">
          {loading && !myGroups.length && <div>Ladataan…</div>}
          {!loading && !myGroups.length && <div>Ei ryhmiä vielä.</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {myGroups.map((g) => (
              <button
                key={g.group_id}
                onClick={() => setSelectedId(g.group_id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-primary)",
                  background: selectedId === g.group_id ? "var(--color-primary)" : "var(--color-surface)",
                  color: selectedId === g.group_id ? "var(--color-surface)" : "var(--color-text)",
                  cursor: "pointer",
                }}
                title={g.role === "owner" ? "Omistaja" : "Jäsen"}
              >
                {g.group_name} &nbsp;<Pill>{g.role}</Pill>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Kaikki ryhmät">
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Haku nimen perusteella"
              value={allSearch}
              onChange={(e) => setAllSearch(e.target.value)}
              autoComplete="off"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-primary)" }}
            />
          </div>
          {loading && !allGroups.length && <div>Ladataan…</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {filteredAll.map((g) => (
              <div
                key={g.group_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-primary)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>{g.group_name}</strong>
                  <Pill>{g.member_count} jäsentä</Pill>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => requestJoin(g.group_id)}
                    style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
                  >
                    Pyydä liittymistä
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(g.group_id)}
                    style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
                  >
                    Avaa
                  </button>
                </div>
              </div>
            ))}
            {!filteredAll.length && <div>Ei osumia.</div>}
          </div>
        </Panel>
      </div>

      {/* Pääpaneelit: jäsenet | keskialue | info+admin */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 320px", gap: 16 }}>
        {/* Jäsenet */}
        <Panel
          title={`Jäsenet (${members.filter((m) => m.status === "approved").length})`}
          footer={
            role && role !== "owner" ? (
              <button
                type="button"
                onClick={leaveGroup}
                style={{ marginTop: 12, width: "100%", padding: 8, borderRadius: 6, cursor: "pointer" }}
                disabled={!selectedId}
              >
                Poistu ryhmästä
              </button>
            ) : null
          }
        >
          {!selectedId && <div>Valitse ryhmä yllä.</div>}
          {selectedId && !group && (
            <div style={{ color: "#666" }}>
              Et ole jäsen — pyydä liittymistä “Kaikki ryhmät” -osiosta.
            </div>
          )}

          {group && (
            <div style={{ display: "grid", gap: 6 }}>
              {members
                .filter((m) => m.status === "approved")
                .map((m) => (
                  <div
                    key={m.member_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <div>
                      {m.user_id === group.owner_id ? <strong>Owner</strong> : <span>Jäsen</span>}
                      {" — "}
                      <span>{m.email}</span>
                    </div>
                    {role === "owner" && m.user_id !== group.owner_id && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.email)}
                        style={{ padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                      >
                        Poista
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </Panel>

        {/* Keskialue (mockup-henkinen otsikko) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            minHeight: 200,
            border: "1px dashed #ddd",
            borderRadius: 8,
          }}
        >
          <h2 style={{ marginTop: 16 }}>
            {group ? `Tervetuloa ryhmään “${group.group_name}”` : "Valitse ryhmä"}
          </h2>
        </div>

        {/* Info & hallinta */}
        <Panel title="Info & hallinta">
          {group ? (
            <>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
                Omistaja: <strong>{group.owner_email}</strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${window.location.origin}/groups?open=${selectedId}`)
                    .then(() => { ok("Ryhmälinkki kopioitu"); clearMsgLater(); })
                }
                style={{ width: "100%", padding: 8, borderRadius: 6, marginBottom: 8, cursor: "pointer" }}
              >
                Jaa ryhmälinkki
              </button>

              {role === "owner" ? (
                <button
                  type="button"
                  onClick={deleteGroup}
                  style={{ width: "100%", padding: 8, borderRadius: 6, cursor: "pointer" }}
                >
                  Poista ryhmä (omistaja)
                </button>
              ) : (
                <div style={{ fontSize: 12, color: "#666" }}>Vain omistaja voi poistaa ryhmän.</div>
              )}
            </>
          ) : (
            <div>Ei valittua ryhmää.</div>
          )}
        </Panel>
      </div>

      {/* Omistajan työkalut */}
      {role === "owner" && group && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Panel title="Liittymispyynnöt">
            {!requests.length && <div>Ei odottavia pyyntöjä.</div>}
            <div style={{ display: "grid", gap: 8 }}>
              {requests.map((r) => (
                <div
                  key={`${r.user_id}-${r.joined_at}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                                      background: "var(--color-surface)",
                                      border: "1px solid var(--color-primary)",                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div>{r.email}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => approveJoin(r.email)}
                      style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
                    >
                      Hyväksy
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectJoin(r.email)}
                      style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
                    >
                      Hylkää
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Kutsu ryhmään sähköpostilla">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inviteRef}
                type="email"
                placeholder="kayttaja@esimerkki.fi"
                autoComplete="off"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
              />
              <button
                type="button"
                onClick={addMember}
                style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}
              >
                Kutsu
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
              Jos käyttäjällä on jo pending-pyyntö, se <strong>hyväksytään automaattisesti</strong>.
            </div>
          </Panel>
        </div>
      )}
      <Panel title="Ryhmän elokuvat">
        <button id="show-group-movies" onClick={toggleMovies}>
          {(showMovies) ? "Piilota elokuvat" : "Näytä elokuvat"}
        </button>
        {showMovies && (
          <div>
            <div style={{ display: "grid", gap: 8 }}>
              
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}


"use client";
import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const CurrentUserContext = createContext();

export const CurrentUserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/current-user");
        setCurrentUser(res.data);
      } catch {
        setCurrentUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
};

export const useCurrentUser = () => useContext(CurrentUserContext);

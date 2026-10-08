import axios from "axios";

const api = axios.create({
  baseURL: "https://chico-sense-back.onrender.com",
  timeout: 30000,
});

export default api;
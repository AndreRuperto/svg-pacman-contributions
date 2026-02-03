import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProfile } from './pages/PlayerProfile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><h1 className="text-4xl font-bold">🏆 Pac-Man Ranking</h1></div>} />
        <Route path="/player/:username" element={<PlayerProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

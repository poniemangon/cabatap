import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { Analytics } from '@vercel/analytics/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import DailyResultPage from './pages/DailyResultPage.jsx'
import ClerkTokenBridge from './auth/ClerkTokenBridge.jsx'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkTokenBridge />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/duelo/:code" element={<App />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/mapa-diario/:id" element={<DailyResultPage />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
    <Analytics />
  </StrictMode>,
)

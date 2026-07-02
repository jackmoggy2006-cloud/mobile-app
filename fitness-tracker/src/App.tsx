import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FitnessProvider } from './context/FitnessContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import LogWorkout from './components/LogWorkout'
import Workouts from './components/Workouts'
import Metrics from './components/Metrics'
import Goals from './components/Goals'

export default function App() {
  return (
    <FitnessProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="log" element={<LogWorkout />} />
            <Route path="workouts" element={<Workouts />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="goals" element={<Goals />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FitnessProvider>
  )
}

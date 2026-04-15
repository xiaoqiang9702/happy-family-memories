import { useLocation } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitioning, setTransitioning] = useState(false)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      setTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayChildren(children)
        setTransitioning(false)
        prevPath.current = location.pathname
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setDisplayChildren(children)
    }
  }, [location.pathname, children])

  return (
    <div
      className={`transition-opacity duration-150 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
    >
      {displayChildren}
    </div>
  )
}

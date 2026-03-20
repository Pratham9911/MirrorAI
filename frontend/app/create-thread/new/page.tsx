"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Plus,
  X,
  Globe,
  Building2,
  Tag,
  FileText,
  Package,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Competitor {
  id: string
  name: string
  url: string
  description: string
}

const availableTags = [
  "Pricing",
  "Features",
  "Marketing",
  "Product",
  "Team",
  "Technology",
  "Funding",
  "News"
]

export default function NewThreadPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    threadName: "",
    productName: "",
    description: "",
    tags: [] as string[]
  })
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [showCompetitorForm, setShowCompetitorForm] = useState(false)
  const [newCompetitor, setNewCompetitor] = useState({
    name: "",
    url: "",
    description: ""
  })

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }

  const handleAddCompetitor = () => {
    if (newCompetitor.name && newCompetitor.url) {
      setCompetitors([
        ...competitors,
        { ...newCompetitor, id: Date.now().toString() }
      ])
      setNewCompetitor({ name: "", url: "", description: "" })
      setShowCompetitorForm(false)
    }
  }

  const handleRemoveCompetitor = (id: string) => {
    setCompetitors(competitors.filter(c => c.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch('http://localhost:8000/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, competitors })
      })
      router.push("/create-thread")
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/create-thread">
            <Button variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Thread</h1>
            <p className="text-sm text-muted-foreground">
              Configure your monitoring thread and add competitors
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        <div className="flex gap-8">
          {/* Left side - Product Info (larger) */}
          <div className="flex-1 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Package className="h-5 w-5 text-muted-foreground" />
                Product Information
              </h2>

              <div className="space-y-5">
                {/* Thread Name */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Thread Name
                  </label>
                  <input
                    type="text"
                    value={formData.threadName}
                    onChange={(e) => setFormData({ ...formData, threadName: e.target.value })}
                    placeholder="e.g., Q1 Competitor Analysis"
                    className="h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground transition-all"
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="e.g., Cortex Pro"
                    className="h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what you want to monitor and analyze..."
                    rows={4}
                    className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground transition-all resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                          formData.tags.includes(tag)
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium"
              >
                Create Thread
              </Button>
              <Link href="/create-thread">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-xl border-border hover:bg-muted"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side - Competitors (smaller) */}
          <div className="w-96">
            <div className="rounded-xl border border-border bg-card p-6 sticky top-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  Competitors
                </h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {competitors.length}
                </span>
              </div>

              {/* Competitor List */}
              <div className="space-y-3 mb-4">
                {competitors.map((competitor) => (
                  <div
                    key={competitor.id}
                    className="group rounded-lg border border-border bg-muted/20 p-3 transition-all hover:border-muted-foreground/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{competitor.name}</p>
                        <p className="text-xs text-info truncate">{competitor.url}</p>
                        {competitor.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {competitor.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompetitor(competitor.id)}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {competitors.length === 0 && !showCompetitorForm && (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <Globe className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No competitors added</p>
                  </div>
                )}
              </div>

              {/* Add Competitor Form */}
              {showCompetitorForm ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <input
                    type="text"
                    value={newCompetitor.name}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                    placeholder="Competitor name"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
                  />
                  <input
                    type="url"
                    value={newCompetitor.url}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, url: e.target.value })}
                    placeholder="https://competitor.com"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
                  />
                  <textarea
                    value={newCompetitor.description}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, description: e.target.value })}
                    placeholder="Short description (optional)"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleAddCompetitor}
                      className="flex-1 h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-sm"
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowCompetitorForm(false)
                        setNewCompetitor({ name: "", url: "", description: "" })
                      }}
                      className="h-9 rounded-lg hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompetitorForm(true)}
                  className="w-full gap-2 rounded-xl border-dashed border-border hover:border-muted-foreground hover:bg-muted/30"
                >
                  <Plus className="h-4 w-4" />
                  Add Competitor
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

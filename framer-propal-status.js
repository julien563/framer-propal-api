import { connect } from "framer-api"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed")

  // Sécurité : secret partagé n8n -> Vercel
  if (req.headers["x-secret"] !== process.env.N8N_SHARED_SECRET) {
    return res.status(401).send("Unauthorized")
  }

  const { slug, status } = req.body || {}
  if (!slug || !status) return res.status(400).send("Missing slug/status")

  const framer = await connect(
    process.env.FRAMER_PROJECT_URL,
    process.env.FRAMER_API_KEY
  )

  // Trouver la collection qui contient le champ "Statut propal"
  const collections = await framer.getCollections()

  let targetCollection = null
  let statusField = null

  for (const c of collections) {
    const fields = await c.getFields()
    const f = fields.find(x => x.name === "Statut propal")
    if (f) {
      targetCollection = c
      statusField = f
      break
    }
  }

  if (!targetCollection) return res.status(404).send("Collection not found")
  if (!statusField) return res.status(404).send("Field not found")

  // Trouver l’item par slug
  const items = await targetCollection.getItems()
  const item = items.find(i => i.slug === slug)
  if (!item) return res.status(404).send("Item not found")

  // Update du champ
  await item.setAttributes({
    fieldData: {
      [statusField.id]: { type: "string", value: status }
    }
  })

  // Publier (et deploy si dispo)
  const publishResult = await framer.publish()
  if (publishResult?.deployment?.id) {
    await framer.deploy(publishResult.deployment.id)
  }

  framer.disconnect()

  return res.status(200).json({ ok: true })
}

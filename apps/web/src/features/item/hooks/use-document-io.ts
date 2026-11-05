import type { ItemType } from '@docgraph/common/schemas'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import type { Editor } from '@tiptap/react'
import type { ChangeEvent } from 'react'
import { toast } from '@/components/ui/toast'
import { showErrorToast } from '@/lib/error-toast'
import { parseDocumentFile } from '../components/document/document-import.helpers'
import { downloadDocgraph, downloadFile } from '../lib/download.helpers'

type UseDocumentIoArgs = {
  editor: Editor
  itemName: string
}

/**
 * Import/export plumbing for the document editor, mirroring the diagram
 * sidebars: JSON export of the editor content, `.docgraph` binary export of the
 * raw CRDT state, Markdown export of the editor content, and file import.
 */
export const useDocumentIo = ({ editor, itemName }: UseDocumentIoArgs) => {
  const provider = useHocuspocusProvider()

  const handleDownloadJson = () => {
    downloadFile(
      JSON.stringify({ type: 'DOCUMENT' satisfies ItemType, document: editor.getJSON() }, null, 2),
      `${itemName}.json`,
      'json',
    )
  }

  const handleDownloadMarkdown = () => {
    downloadFile(editor.getMarkdown(), `${itemName}.md`, 'markdown')
  }

  const handleDownloadBinary = () => {
    downloadDocgraph(provider.document, itemName)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = await parseDocumentFile(file)
    if (!result.ok) {
      toast.add({ type: 'error', title: 'Import failed', description: result.error })
      return
    }

    try {
      if (result.data.kind === 'json') {
        // Without the flag TipTap swaps content it cannot parse for an empty document instead of throwing.
        editor.commands.setContent(result.data.document, { errorOnInvalidContent: true })
      } else {
        editor.commands.setContent(result.data.markdown, { contentType: 'markdown' })
      }
    } catch (error) {
      showErrorToast('Could not apply the imported file', error)
    }
  }

  return { handleImport, handleDownloadJson, handleDownloadMarkdown, handleDownloadBinary }
}

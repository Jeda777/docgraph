import {
  API_KEY_HEADER,
  API_KEY_MAX_EXPIRATION_DAYS,
  type ApiKey,
  type ApiKeyCreateInput,
  apiKeyCreateInputSchema,
  apiKeyDateInDays,
  UNRESTRICTED_API_KEY,
} from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { FormCheckbox } from '@/components/form/form-checkbox'
import { FormInput } from '@/components/form/form-input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useApiKeyCreate, useApiKeyDelete, useApiKeyGetList, useProjectGetList } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { formatDate } from '@/lib/utils'
import { ApiKeyScopeField } from './api-key-scope-field'
import { describeApiKeyAccess, describeApiKeyExpiry } from './api-keys.helpers'

const MCP_URL = `${location.origin}/mcp`

const DEFAULT_VALUES: ApiKeyCreateInput = {
  name: '',
  expiresOn: '',
  restrictions: UNRESTRICTED_API_KEY,
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ type: 'success', title: 'Copied to clipboard' })
  } catch {
    toast.add({ type: 'error', title: 'Could not copy', description: 'Copy the text manually.' })
  }
}

type CopyBlockProps = {
  label: string
  value: string
}

const CopyBlock = ({ label, value }: CopyBlockProps) => (
  <div className='flex flex-col gap-1'>
    <span className='text-xs text-muted-foreground'>{label}</span>
    <div className='flex items-start gap-1'>
      <code className='min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs'>
        {value}
      </code>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={`Copy ${label}`}
        onClick={() => copy(value)}
      >
        <Copy />
      </Button>
    </div>
  </div>
)

/**
 * Personal API keys for the MCP endpoint, so AI agents can read and update
 * diagrams on the user's behalf.
 */
export const ApiKeysSection = () => {
  const { data: apiKeys } = useApiKeyGetList()
  const hasRestrictedKeys = Boolean(apiKeys?.some((apiKey) => apiKey.restrictions.projects))
  const { data: projects = [] } = useProjectGetList(hasRestrictedKeys)
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const { mutate: create, isPending: isCreating } = useApiKeyCreate()
  const { mutate: remove, isPending: isDeleting } = useApiKeyDelete()
  const [createdKey, setCreatedKey] = useState<string>()
  const [keyToDelete, setKeyToDelete] = useState<ApiKey>()
  const form = useForm<ApiKeyCreateInput>({
    resolver: zodResolver(apiKeyCreateInputSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const onSubmit = (data: ApiKeyCreateInput) => {
    if (isCreating) return

    create(data, {
      onError: (error) => showErrorToast('Could not create the API key', error),
      onSuccess: ({ key }) => {
        setCreatedKey(key)
        // React Compiler memoizes `register`, so inputs would not re-register after a plain reset
        form.reset(undefined, { keepFieldsRef: true })
      },
    })
  }

  const onDelete = () => {
    if (!keyToDelete || isDeleting) return

    remove(keyToDelete.id, {
      onError: (error) => showErrorToast('Could not revoke the API key', error),
      onSuccess: () => {
        setKeyToDelete(undefined)
        toast.add({ type: 'success', title: 'API key revoked' })
      },
    })
  }

  return (
    <section className='flex flex-col gap-3'>
      <div>
        <h3 className='font-semibold'>AI agents (MCP)</h3>
        <p className='text-sm text-muted-foreground'>
          API keys let AI agents such as Claude Code or Cursor read and update your diagrams and
          documents, e.g. to turn a database diagram into migrations or document a codebase.
        </p>
      </div>

      {createdKey && (
        <div className='flex flex-col gap-2 rounded-lg border p-3'>
          <p className='text-sm font-medium'>Copy the API key now — it will not be shown again.</p>
          <CopyBlock label='API key' value={createdKey} />
          <CopyBlock
            label='Claude Code'
            value={`claude mcp add --transport http docgraph ${MCP_URL} --header "${API_KEY_HEADER}: ${createdKey}"`}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setCreatedKey(undefined)}
          >
            Done
          </Button>
        </div>
      )}

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-3'>
          <FormInput<ApiKeyCreateInput>
            name='name'
            label='Name'
            placeholder='Key name, e.g. laptop'
          />
          <FormInput<ApiKeyCreateInput>
            name='expiresOn'
            label='Expires on (leave empty to never expire)'
            type='date'
            min={apiKeyDateInDays(1)}
            max={apiKeyDateInDays(API_KEY_MAX_EXPIRATION_DAYS)}
          />
          <FormCheckbox<ApiKeyCreateInput>
            name='restrictions.readOnly'
            label='Read-only (agents can read but not create or change anything)'
          />
          <ApiKeyScopeField />
          <Button type='submit' disabled={isCreating} className='self-start'>
            Create API key
          </Button>
        </form>
      </FormProvider>

      {apiKeys && apiKeys.length > 0 && (
        <ul className='flex max-h-60 flex-col divide-y overflow-y-auto rounded-lg border'>
          {apiKeys.map((apiKey) => (
            <li key={apiKey.id} className='flex items-center gap-2 px-3 py-2'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{apiKey.name}</p>
                <p className='text-xs text-muted-foreground my-px'>
                  Created {formatDate(apiKey.createdAt)}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Last used {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'never'}
                </p>
                <p className='text-xs text-muted-foreground my-px'>
                  {describeApiKeyAccess(apiKey.restrictions, projectNames)}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {describeApiKeyExpiry(apiKey.expiresAt)}
                </p>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={`Revoke ${apiKey.name}`}
                onClick={() => setKeyToDelete(apiKey)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={Boolean(keyToDelete)}
        onOpenChange={(open) => !open && setKeyToDelete(undefined)}
        description={`Agents using "${keyToDelete?.name}" will lose access immediately.`}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </section>
  )
}

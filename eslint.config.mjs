import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['components/laser/scene.tsx', 'components/laser/sparks.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
]

export default eslintConfig

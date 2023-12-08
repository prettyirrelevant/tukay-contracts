module.exports = {
    'rules': {
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ],
        'indent': [
            'error',
            4
        ]
    },
    'overrides': [
        {
            'parserOptions': {
                'sourceType': 'script'
            },
            'files': [
                '.eslintrc.{js,cjs}'
            ],
            'env': {
                'node': true
            }
        }
    ],
    'extends': [
        'plugin:perfectionist/recommended-line-length',
        'plugin:@typescript-eslint/recommended',
        'eslint:recommended',
    ],
    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },
    'env': {
        'es2021': true,
        'mocha': true,
        'node': true,

    },
    'plugins': [
        '@typescript-eslint',
        'perfectionist',
    ],
    'parser': '@typescript-eslint/parser'
};

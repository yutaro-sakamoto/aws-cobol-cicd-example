AWS CDKのコードがNode.jsのLambda関数を定義するとき、ランタイムのバージョンは22を指定すること。
たとえばlambda.Runtime.NODEJS_14_Xではなく、lambda.Runtime.NODEJS_22_Xを使うこと。

GitHub Actionsのワークフローファイルにおいて、useキーワードでactions/checkoutのような公式のアクションを指定するときは、かならず@v4のバージョンを指定すること。
つまり、actions/checkout@v2ではなくactions/checkout@v4を使うこと。

日本語の文章は、必ず「である調」を使い、「ですます調」は使わないこと。
例えば、「変数である」「実行せよ」という文は使って良いが、「変数です」「実行してください」という文は使わないこと。

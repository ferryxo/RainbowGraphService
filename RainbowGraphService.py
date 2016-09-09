from flask import Flask, request, render_template, jsonify
from flask_cors import CORS, cross_origin
import uuid
import json

app = Flask(__name__)
CORS(app)

configTable = {}

@app.route('/configure', methods=['POST'])
@cross_origin()
def index():
    id = uuid.uuid4();
    configTable[id.urn[9:]] = request.json
    return jsonify(id=id)

@app.route('/vis/<id>', methods=['GET'])

def visualize(id):
 config = configTable[id]
 return render_template('index.html', json_data = json.dumps(config))

if __name__ == '__main__':
    app.run(debug=True)

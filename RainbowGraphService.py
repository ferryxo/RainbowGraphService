from flask import Flask, request, render_template, jsonify
from flask.ext.api import status
from flask_cors import CORS, cross_origin
import uuid
import json
import xlrd
import openpyxl

app = Flask(__name__)
CORS(app)

configTable = {}


@app.route('/file-upload', methods=['POST'])
@cross_origin()
def file_upload():
    file = request.files['file']

    #check type of the files, find a way to check the header
    if file.filename.endswith(".csv"):
        print("handle csv")

    elif file.filename.endswith(".xls"):
        print("handle .xsl")
        book = xlrd.open_workbook(file_contents=file.read())
        data_sheet = book.sheet_by_index(0)
        cell00 = data_sheet.cell(0,0)  # 1st row

        if data_sheet.cell(4,0).value == "Paper Author" and data_sheet.cell(4,1).value == "Reviewer":
            #handle sword data
            review_scores={}

            for row in range(5, data_sheet.nrows):

                individual_score=review_scores.get(data_sheet.cell(row,0).value)
                if individual_score == None :
                    individual_score = {}

                divider = 0
                score_sum = 0
                for col in range(2, data_sheet.ncols):
                    if not data_sheet.cell(row, col).value == '':
                        score_sum += float(data_sheet.cell(row, col).value)
                        divider += 1

                individual_score[data_sheet.cell(row, 1).value] = score_sum / float(divider)

                review_scores[data_sheet.cell(row, 0).value] = individual_score

        return jsonify(review_scores=review_scores), status.HTTP_200_OK


    elif file.filename.endswith(".xlsx"):
        print("handle .xlsx")







@app.route('/instructor', methods=['GET'])
@cross_origin()
def instructor():
    #check type of the files
    return render_template('instructor.html')

@app.route('/configure', methods=['GET', 'POST'])
@cross_origin()
def index():
    if request.method == 'GET':
        return render_template('input_form.html')

    try:
        with open('configTable.json', 'r') as f:
            configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
    except:
        configTable = {}

    id = uuid.uuid4();
    configTable[id.urn[9:]] = request.json

    with open('configTable.json', 'w+') as f:
        json.dump(configTable, f)

    return jsonify(url="http://peerlogic.csc.ncsu.edu/rainbowgraph/viz/" + id.urn[9:])

@app.route('/viz/<id>', methods=['GET'])
@cross_origin()
def visualize(id):
 # load from file:
 try:
   with open('configTable.json', 'r') as f:
       configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
 except ValueError:
   configTable = {}
 config = configTable[id]
 return render_template('index.html', json_data = json.dumps(config))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3005, threaded=True)
